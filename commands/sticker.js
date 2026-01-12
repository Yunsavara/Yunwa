const Jimp = require("jimp");

/**
 * Sticker command - Convert image to WhatsApp sticker with optional text
 * Usage: !sticker [t:text] [b:text]
 * Examples:
 *   !sticker (reply to image)
 *   !sticker t:Hello
 *   !sticker b:World
 *   !sticker t:Hello b:World
 */
module.exports = {
    name: "sticker",
    description: "Convert image to sticker with optional text overlay",
    category: "media",

    async execute(yunwa, msg, sender, pushname, args = []) {
        try {
            await yunwa.sendPresenceUpdate("composing", sender);

            // Check if message is a reply to an image
            const quotedMsg =
                msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const hasImage = quotedMsg?.imageMessage;

            if (!hasImage) {
                await yunwa.sendMessage(sender, {
                    text:
                        "❌ *How to use:* Reply to an image with !sticker [options]\n\n" +
                        "*Examples:*\n" +
                        "• !sticker\n" +
                        "• !sticker t:Hello\n" +
                        "• !sticker b:World\n" +
                        "• !sticker t:Hello b:World\n\n" +
                        "⚠️ Max 30 characters per text",
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
                                text: "❌ Top text must be 30 characters or less!",
                            });
                            return;
                        }
                    } else if (arg.startsWith("b:")) {
                        bottomText = arg.slice(2).trim();
                        if (bottomText.length > 30) {
                            await yunwa.sendMessage(sender, {
                                text: "❌ Bottom text must be 30 characters or less!",
                            });
                            return;
                        }
                    }
                }
            }

            // Download the image
            const imageBuffer = await yunwa.downloadMediaMessage(
                msg.message.extendedTextMessage.contextInfo.quotedMessage,
            );

            if (!imageBuffer) {
                await yunwa.sendMessage(sender, {
                    text: "❌ Failed to download image!",
                });
                return;
            }

            // Process image with Jimp
            let image = await Jimp.read(imageBuffer);

            // Get image dimensions
            const width = image.getWidth();
            const height = image.getHeight();

            // Calculate dimensions to fit 512x512 maintaining aspect ratio
            let targetWidth, targetHeight;
            if (width > height) {
                targetWidth = 512;
                targetHeight = Math.round((height / width) * 512);
            } else {
                targetHeight = 512;
                targetWidth = Math.round((width / height) * 512);
            }

            // Resize image
            image = image.resize(targetWidth, targetHeight);

            // Create canvas with padding for text if needed
            let finalHeight = targetHeight;
            let yOffset = 0;

            if (topText || bottomText) {
                const textPadding = 50;
                if (topText) finalHeight += textPadding;
                if (bottomText) finalHeight += textPadding;
                if (topText) yOffset = textPadding;

                // Create new image with extra space for text
                const newImage = new Jimp(targetWidth, finalHeight, 0x00000000);
                newImage.composite(image, 0, yOffset);
                image = newImage;
            }

            // Load font
            const font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);

            // Add text overlays
            if (topText) {
                const textWidth = Jimp.measureText(font, topText.toUpperCase());
                const x = (targetWidth - textWidth) / 2;
                image.print(
                    font,
                    x,
                    10,
                    {
                        text: topText.toUpperCase(),
                        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                    },
                    targetWidth,
                );
            }

            if (bottomText) {
                const textY = finalHeight - 60;
                image.print(
                    font,
                    0,
                    textY,
                    {
                        text: bottomText.toUpperCase(),
                        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                    },
                    targetWidth,
                );
            }

            // Convert to buffer
            const stickerBuffer = await image
                .quality(95)
                .getBufferAsync(Jimp.MIME_PNG);

            // Send as sticker
            await yunwa.sendMessage(sender, {
                sticker: stickerBuffer,
            });

            await yunwa.sendPresenceUpdate("paused", sender);
        } catch (error) {
            console.error("Error in sticker command:", error);
            await yunwa.sendMessage(sender, {
                text: `❌ ${error.message || "Error occurred while creating sticker"}\n\n💡 Make sure to reply to an image!`,
            });
        }
    },
};
