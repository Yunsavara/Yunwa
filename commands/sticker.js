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
                        "❌ *How to use:* Reply to a photo with !sticker [options]\n\n" +
                        "*Examples:*\n" +
                        "• !sticker\n" +
                        "• !sticker t:Hello World\n" +
                        "• !sticker b:Bottom Text\n" +
                        "• !sticker t:Top Text b:Bottom Text\n\n" +
                        "⚠️ Maximum 30 characters per text",
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
                            text: "❌ Top text maximum 30 characters!",
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
                            text: "❌ Bottom text maximum 30 characters!",
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
                throw new Error("Failed to download image");
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

            // Crop to 512x512 with proportional adjustment
            const cropX = Math.floor((scaledWidth - targetSize) / 2);

            // For vertical crop, bias towards top if image is zoomed a lot
            // If scale > 1.5, the image is too small and needs heavy zoom
            let cropY;
            if (scaledHeight > targetSize) {
                if (scale > 1.5) {
                    // Heavy zoom - very strong top bias
                    cropY = Math.floor((scaledHeight - targetSize) * 0.1);
                } else if (scale > 1.2) {
                    // Medium zoom - strong top bias
                    cropY = Math.floor((scaledHeight - targetSize) * 0.2);
                } else {
                    // Light zoom - moderate top bias
                    cropY = Math.floor((scaledHeight - targetSize) * 0.25);
                }
            } else {
                cropY = 0;
            }

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
                    const baseFontSize = 60;
                    const minFontSize = 30;
                    const horizontalPadding = 80; // Total left-right padding
                    const charWidthRatio = 0.7; // Character width ratio for Impact font

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

                // Path to custom Impact font in assets
                const impactFontPath = path.join(
                    __dirname,
                    "../assets/fonts/impact.ttf",
                );

                // Check if custom font exists
                let useCustomFont = false;
                try {
                    await fs.access(impactFontPath);
                    useCustomFont = true;
                } catch (e) {
                    console.log(
                        "Custom Impact font not found, using system fonts",
                    );
                }

                let commands = [];

                if (topText) {
                    const fontSize = calculateFontSize(topText, 512);
                    const escapedText = topText.replace(/'/g, "'\\''");
                    // Meme-style text: Impact font, white fill, black stroke
                    const fontArg = useCustomFont
                        ? `"${impactFontPath}"`
                        : "Impact";
                    commands.push(
                        `-gravity North -pointsize ${fontSize} -fill white -stroke black -strokewidth 4 -font ${fontArg} -annotate +0+20 '${escapedText.toUpperCase()}'`,
                    );
                }

                if (bottomText) {
                    const fontSize = calculateFontSize(bottomText, 512);
                    const escapedText = bottomText.replace(/'/g, "'\\''");
                    const fontArg = useCustomFont
                        ? `"${impactFontPath}"`
                        : "Impact";
                    commands.push(
                        `-gravity South -pointsize ${fontSize} -fill white -stroke black -strokewidth 4 -font ${fontArg} -annotate +0+20 '${escapedText.toUpperCase()}'`,
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

                    // Try fallback fonts if custom font fails
                    if (
                        !useCustomFont ||
                        convertError.message.includes("font")
                    ) {
                        console.log(
                            "Primary font failed, trying fallback fonts...",
                        );

                        const fallbackFonts = [
                            "Arial-Bold",
                            "DejaVu-Sans-Bold",
                            "Helvetica-Bold",
                        ];
                        let success = false;

                        for (const fallbackFont of fallbackFonts) {
                            try {
                                const fallbackCommands = commands.map((cmd) =>
                                    cmd.replace(
                                        /-font\s+[^\s]+/,
                                        `-font ${fallbackFont}`,
                                    ),
                                );
                                const fallbackCmd = `magick "${tempPngPath}" ${fallbackCommands.join(" ")} "${tempTextPath}"`;
                                await execAsync(fallbackCmd);
                                tempPngPath = tempTextPath;
                                success = true;
                                console.log(
                                    `Using fallback font: ${fallbackFont}`,
                                );
                                break;
                            } catch (e) {
                                continue;
                            }
                        }

                        if (!success) {
                            console.error(
                                "All fonts failed, proceeding without text",
                            );
                        }
                    }
                }
            }

            // Convert to WebP using cwebp
            await execAsync(
                `cwebp -q 100 -preset icon "${tempPngPath}" -o "${tempWebpPath}"`,
            );

            // Read WebP file
            const stickerBuffer = await fs.readFile(tempWebpPath);

            // Send sticker with metadata
            await yunwa.sendMessage(sender, {
                sticker: stickerBuffer,
                packname: "Yunwa WA Bot",
                author: pushname || "User",
            });

            await yunwa.sendPresenceUpdate("paused", sender);
        } catch (error) {
            console.error("Error in sticker command:", error);
            console.error("Stack:", error.stack);

            let errorMsg = `❌ Error: ${error.message}\n\n💡 Make sure to reply to a photo!`;

            if (error.message.includes("cwebp")) {
                errorMsg =
                    "❌ cwebp is not installed!\n\nInstall: pkg install libwebp";
            } else if (error.message.includes("magick")) {
                errorMsg =
                    "❌ ImageMagick is not installed!\n\nInstall: pkg install imagemagick";
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
