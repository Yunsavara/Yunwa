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
        let tempWebpPath = null;

        try {
            await yunwa.sendPresenceUpdate("composing", sender);

            // Check if message is a reply to an image
            // Handle both private chat and group
            const quotedMsg =
                msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            // Check various possible locations for image
            let imageMessage = null;

            if (quotedMsg?.imageMessage) {
                imageMessage = quotedMsg.imageMessage;
            } else if (msg.message?.imageMessage) {
                // Direct image (not quoted)
                imageMessage = msg.message.imageMessage;
            }

            if (!imageMessage) {
                await yunwa.sendMessage(sender, {
                    text:
                        "❌ *Cara pakai:* Reply foto atau kirim foto dengan caption !sticker [options]\n\n" +
                        "*Contoh:*\n" +
                        "• !sticker\n" +
                        "• !sticker t:Hello\n" +
                        "• !sticker b:World\n" +
                        "• !sticker t:Hello b:World\n\n" +
                        "⚠️ Maksimal 30 karakter per teks",
                });
                return;
            }

            // Parse text options
            let topText = null;
            let bottomText = null;

            if (args && args.length > 0) {
                for (const arg of args) {
                    if (arg.startsWith("t:")) {
                        topText = arg.slice(2).trim();
                        if (topText.length > 30) {
                            await yunwa.sendMessage(sender, {
                                text: "❌ Teks atas maksimal 30 karakter!",
                            });
                            return;
                        }
                    } else if (arg.startsWith("b:")) {
                        bottomText = arg.slice(2).trim();
                        if (bottomText.length > 30) {
                            await yunwa.sendMessage(sender, {
                                text: "❌ Teks bawah maksimal 30 karakter!",
                            });
                            return;
                        }
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

            // Calculate target dimensions
            let targetWidth, targetHeight;
            if (width > height) {
                targetWidth = 512;
                targetHeight = Math.round((height / width) * 512);
            } else {
                targetHeight = 512;
                targetWidth = Math.round((width / height) * 512);
            }

            // Resize
            image = await image.resize({ w: targetWidth, h: targetHeight });

            // Add text if needed
            if (topText || bottomText) {
                const textPadding = 60;
                let finalHeight = targetHeight;
                let yOffset = 0;

                if (topText) finalHeight += textPadding;
                if (bottomText) finalHeight += textPadding;
                if (topText) yOffset = textPadding;

                const newImage = new Jimp({
                    width: targetWidth,
                    height: finalHeight,
                    color: 0x00000000,
                });

                await newImage.composite(image, 0, yOffset);
                image = newImage;

                // Load font using proper Jimp v1.x syntax
                const { loadFont } = require("jimp");
                let font;
                try {
                    // Try to load built-in font
                    font = await loadFont("sans-64-white");
                } catch (e) {
                    // Fallback to other font
                    try {
                        font = await loadFont("sans-32-white");
                    } catch (e2) {
                        console.error("Could not load font, skipping text");
                        // If font fails, continue without text
                        image = await image.resize({
                            w: targetWidth,
                            h: targetHeight,
                        });
                        throw new Error(
                            "Font tidak tersedia. Gunakan sticker tanpa text.",
                        );
                    }
                }

                if (topText && font) {
                    image.print({
                        font,
                        x: 0,
                        y: 5,
                        text: {
                            text: topText.toUpperCase(),
                            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                        },
                        maxWidth: targetWidth,
                    });
                }

                if (bottomText && font) {
                    const textY = finalHeight - 65;
                    image.print({
                        font,
                        x: 0,
                        y: textY,
                        text: {
                            text: bottomText.toUpperCase(),
                            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                        },
                        maxWidth: targetWidth,
                    });
                }
            }

            // Make 512x512 with padding
            if (image.width !== 512 || image.height !== 512) {
                const finalImage = new Jimp({
                    width: 512,
                    height: 512,
                    color: 0x00000000,
                });
                const xOffset = Math.floor((512 - image.width) / 2);
                const yOffsetFinal = Math.floor((512 - image.height) / 2);
                await finalImage.composite(image, xOffset, yOffsetFinal);
                image = finalImage;
            }

            // Save PNG to temp file
            const tmpDir = os.tmpdir();
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(7);
            tempPngPath = path.join(
                tmpDir,
                `sticker_${timestamp}_${randomId}.png`,
            );
            tempWebpPath = path.join(
                tmpDir,
                `sticker_${timestamp}_${randomId}.webp`,
            );

            const pngBuffer = await image.getBuffer("image/png");
            await fs.writeFile(tempPngPath, pngBuffer);

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

            let errorMsg = `❌ Error: ${error.message}\n\n💡 Pastikan reply ke foto atau kirim foto dengan caption !sticker`;

            // Check if cwebp is not installed
            if (error.message.includes("cwebp")) {
                errorMsg =
                    "❌ cwebp tidak terinstall!\n\nInstall dengan: pkg install libwebp";
            }

            await yunwa.sendMessage(sender, { text: errorMsg });
            await yunwa.sendPresenceUpdate("paused", sender);
        } finally {
            // Cleanup temp files
            try {
                if (tempPngPath) await fs.unlink(tempPngPath);
                if (tempWebpPath) await fs.unlink(tempWebpPath);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    },
};
