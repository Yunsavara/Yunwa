const { Jimp, loadFont } = require("jimp");
const { downloadContentFromMessage } = require("baileys");

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

            // Download the image from quoted message
            const stream = await downloadContentFromMessage(
                quotedMsg.imageMessage,
                "image",
            );

            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            if (!buffer || buffer.length === 0) {
                await yunwa.sendMessage(sender, {
                    text: "❌ Failed to download image!",
                });
                return;
            }

            // Process image with Jimp
            let image = await Jimp.read(buffer);

            // Get image dimensions
            const width = image.width;
            const height = image.height;

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
            image = await image.resize({ w: targetWidth, h: targetHeight });

            // Create canvas with padding for text if needed
            let finalHeight = targetHeight;
            let yOffset = 0;

            if (topText || bottomText) {
                const textPadding = 60;
                if (topText) finalHeight += textPadding;
                if (bottomText) finalHeight += textPadding;
                if (topText) yOffset = textPadding;

                // Create new image with extra space for text
                const newImage = new Jimp({
                    width: targetWidth,
                    height: finalHeight,
                    color: 0x00000000,
                });
                await newImage.composite(image, 0, yOffset);
                image = newImage;
            }

            // Add text overlays if specified
            if (topText || bottomText) {
                // Load font
                const font = await loadFont("SANS_64_WHITE");

                if (topText) {
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

                if (bottomText) {
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

            // Ensure image is properly sized for sticker
            if (image.width !== 512 || image.height !== 512) {
                // Add padding to make it 512x512
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

            // Convert to buffer (PNG format for sticker)
            const stickerBuffer = await image.getBuffer("image/png");

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
