const { Jimp } = require("jimp");
const { downloadContentFromMessage } = require("baileys");
const webp = require("@jimp/js-webp");

// Register WebP plugin
Jimp.decoders["image/webp"] = webp.decode;
Jimp.encoders["image/webp"] = webp.encode;

/**
 * Sticker command - Convert image to WhatsApp sticker with optional text
 * Usage: !sticker [t:text] [b:text]
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
                        "❌ *Cara pakai:* Reply foto dengan !sticker [options]\n\n" +
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
                quotedMsg.imageMessage,
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

                // Create new canvas
                const newImage = new Jimp({
                    width: targetWidth,
                    height: finalHeight,
                    color: 0x00000000,
                });
                await newImage.composite(image, 0, yOffset);
                image = newImage;

                // Load font
                const { loadFont } = require("jimp");
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

            // Convert to WebP
            const stickerBuffer = await image.getBuffer("image/webp");

            // Send sticker
            await yunwa.sendMessage(sender, {
                sticker: stickerBuffer,
            });

            await yunwa.sendPresenceUpdate("paused", sender);
        } catch (error) {
            console.error("Error in sticker command:", error);
            await yunwa.sendMessage(sender, {
                text: `❌ Error: ${error.message}\n\n💡 Pastikan reply ke foto!`,
            });
            await yunwa.sendPresenceUpdate("paused", sender);
        }
    },
};
