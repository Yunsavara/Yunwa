const { Jimp } = require("jimp");
const { downloadContentFromMessage } = require("baileys");
const { exec } = require("child_process");
const { promisify } = require("util");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");

const execAsync = promisify(exec);

/**
 * Sticker command - Convert image to WhatsApp sticker with optional text
 * Usage: !sticker [t:text] [b:text]
 */
module.exports = {
    name: "sticker",
    description: "Convert image to sticker with optional text overlay",
    category: "media",
    async execute(yunwa, msg, sender, pushname, args = []) {
        let tempPngPath = null;
        let tempTextPath = null;
        let tempWebpPath = null;

        try {
            await yunwa.sendPresenceUpdate("composing", sender);

            // Check if message is a reply to an image
            const quotedMsg =
                msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            let imageMessage = null;

            if (quotedMsg?.imageMessage) {
                imageMessage = quotedMsg.imageMessage;
            } else if (msg.message?.imageMessage) {
                imageMessage = msg.message.imageMessage;
            }

            if (!imageMessage) {
                await yunwa.sendMessage(sender, {
                    text:
                        "❌ *Cara pakai:* Reply foto dengan !sticker [options]\n\n" +
                        "*Contoh:*\n" +
                        "• !sticker\n" +
                        "• !sticker t:Hello World\n" +
                        "• !sticker b:Bottom Text\n" +
                        "• !sticker t:Top Text b:Bottom Text\n\n" +
                        "⚠️ Maksimal 30 karakter per teks",
                });
                return;
            }

            // Parse text options - support spaces in text
            let topText = null;
            let bottomText = null;

            if (args && args.length > 0) {
                // Join all args back into a string
                const fullText = args.join(" ");

                // Find t: and b: positions
                const tIndex = fullText.indexOf("t:");
                const bIndex = fullText.indexOf("b:");

                if (tIndex !== -1) {
                    // Extract top text
                    let endIndex =
                        bIndex !== -1 && bIndex > tIndex
                            ? bIndex
                            : fullText.length;
                    topText = fullText.substring(tIndex + 2, endIndex).trim();

                    if (topText.length > 30) {
                        await yunwa.sendMessage(sender, {
                            text: "❌ Teks atas maksimal 30 karakter!",
                        });
                        return;
                    }
                }

                if (bIndex !== -1) {
                    // Extract bottom text
                    let endIndex =
                        tIndex !== -1 && tIndex > bIndex
                            ? tIndex
                            : fullText.length;
                    bottomText = fullText
                        .substring(bIndex + 2, endIndex)
                        .trim();

                    if (bottomText.length > 30) {
                        await yunwa.sendMessage(sender, {
                            text: "❌ Teks bawah maksimal 30 karakter!",
                        });
                        return;
                    }
                }
            }

            // Download the image
            const stream = await downloadContentFromMessage(
                imageMessage,
                "image",
            );

            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            if (!buffer || buffer.length === 0) {
                throw new Error("Gagal download gambar");
            }

            // Process with Jimp
            let image = await Jimp.read(buffer);

            // Get dimensions
            const width = image.width;
            const height = image.height;
            const targetSize = 512;

            // Resize to cover 512x512 (zoom-in/crop strategy)
            // Calculate scale to cover entire 512x512 area
            const scale = Math.max(targetSize / width, targetSize / height);
            const scaledWidth = Math.round(width * scale);
            const scaledHeight = Math.round(height * scale);

            // Resize with cover
            image = await image.resize({ w: scaledWidth, h: scaledHeight });

            // Crop to 512x512 from center
            const cropX = Math.floor((scaledWidth - targetSize) / 2);
            const cropY = Math.floor((scaledHeight - targetSize) / 2);
            image = await image.crop({
                x: cropX,
                y: cropY,
                w: targetSize,
                h: targetSize,
            });

            // Save PNG to temp file
            const tmpDir = os.tmpdir();
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(7);
            tempPngPath = path.join(
                tmpDir,
                `sticker_${timestamp}_${randomId}.png`,
            );
            tempTextPath = path.join(
                tmpDir,
                `sticker_text_${timestamp}_${randomId}.png`,
            );
            tempWebpPath = path.join(
                tmpDir,
                `sticker_${timestamp}_${randomId}.webp`,
            );

            const pngBuffer = await image.getBuffer("image/png");
            await fs.writeFile(tempPngPath, pngBuffer);

            // Add text with ImageMagick if text is provided
            if (topText || bottomText) {
                // Calculate font size based on text length with proper padding
                const calculateFontSize = (text, imageWidth) => {
                    const baseFontSize = 55;
                    const minFontSize = 25;
                    const horizontalPadding = 80; // Padding kiri-kanan total
                    const charWidthRatio = 0.65; // Ratio lebar karakter terhadap font size

                    const availableWidth = imageWidth - horizontalPadding;
                    const estimatedTextWidth =
                        text.length * baseFontSize * charWidthRatio;

                    if (estimatedTextWidth > availableWidth) {
                        // Scale down font size
                        const scaledSize = Math.floor(
                            availableWidth / text.length / charWidthRatio,
                        );
                        return Math.max(scaledSize, minFontSize);
                    }

                    return baseFontSize;
                };

                let commands = [];

                if (topText) {
                    const fontSize = calculateFontSize(topText, 512);
                    const escapedText = topText.replace(/'/g, "'\\''");
                    commands.push(
                        `-gravity North -pointsize ${fontSize} -fill white -stroke black -strokewidth 3 -font DejaVu-Sans-Bold -annotate +0+25 '${escapedText.toUpperCase()}'`,
                    );
                }

                if (bottomText) {
                    const fontSize = calculateFontSize(bottomText, 512);
                    const escapedText = bottomText.replace(/'/g, "'\\''");
                    commands.push(
                        `-gravity South -pointsize ${fontSize} -fill white -stroke black -strokewidth 3 -font DejaVu-Sans-Bold -annotate +0+25 '${escapedText.toUpperCase()}'`,
                    );
                }

                // Use 'magick' for ImageMagick v7
                const convertCmd = `magick "${tempPngPath}" ${commands.join(" ")} "${tempTextPath}"`;

                try {
                    await execAsync(convertCmd);
                    // Use the text version if ImageMagick succeeded
                    tempPngPath = tempTextPath;
                } catch (convertError) {
                    console.error("ImageMagick error:", convertError.message);
                    // Fall back to image without text
                }
            }

            // Convert to WebP using cwebp
            await execAsync(
                `cwebp -q 100 -preset icon "${tempPngPath}" -o "${tempWebpPath}"`,
            );

            // Read WebP file
            const stickerBuffer = await fs.readFile(tempWebpPath);

            // Send sticker
            await yunwa.sendMessage(sender, {
                sticker: stickerBuffer,
            });

            await yunwa.sendPresenceUpdate("paused", sender);
        } catch (error) {
            console.error("Error in sticker command:", error);
            console.error("Stack:", error.stack);

            let errorMsg = `❌ Error: ${error.message}\n\n💡 Pastikan reply ke foto!`;

            if (error.message.includes("cwebp")) {
                errorMsg =
                    "❌ cwebp tidak terinstall!\n\nInstall: pkg install libwebp";
            } else if (error.message.includes("magick")) {
                errorMsg =
                    "❌ ImageMagick tidak terinstall!\n\nInstall: pkg install imagemagick";
            }

            await yunwa.sendMessage(sender, { text: errorMsg });
            await yunwa.sendPresenceUpdate("paused", sender);
        } finally {
            // Cleanup temp files
            try {
                if (tempPngPath && tempPngPath !== tempTextPath)
                    await fs.unlink(tempPngPath);
                if (tempTextPath) await fs.unlink(tempTextPath);
                if (tempWebpPath) await fs.unlink(tempWebpPath);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    },
};
