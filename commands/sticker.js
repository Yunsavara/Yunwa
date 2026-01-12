const { Jimp, loadFont } = require("jimp");
const { SANS_64_WHITE, SANS_64_BLACK } = require("jimp/fonts");
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

            // Add text overlay with stroke effect if needed
            if (topText || bottomText) {
                // Load fonts
                const fontWhite = await loadFont(SANS_64_WHITE);
                const fontBlack = await loadFont(SANS_64_BLACK);

                if (topText) {
                    const text = topText.toUpperCase();
                    const topY = 10;

                    // Create stroke effect by printing black text multiple times (offset)
                    const strokeOffsets = [
                        [-2, -2],
                        [-2, 0],
                        [-2, 2],
                        [0, -2],
                        [0, 2],
                        [2, -2],
                        [2, 0],
                        [2, 2],
                    ];

                    // Print black stroke
                    for (const [offsetX, offsetY] of strokeOffsets) {
                        image.print({
                            font: fontBlack,
                            x: offsetX,
                            y: topY + offsetY,
                            text: {
                                text: text,
                                alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                            },
                            maxWidth: targetWidth,
                        });
                    }

                    // Print white text on top
                    image.print({
                        font: fontWhite,
                        x: 0,
                        y: topY,
                        text: {
                            text: text,
                            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                        },
                        maxWidth: targetWidth,
                    });
                }

                if (bottomText) {
                    const text = bottomText.toUpperCase();
                    const bottomY = targetHeight - 75;

                    // Create stroke effect by printing black text multiple times (offset)
                    const strokeOffsets = [
                        [-2, -2],
                        [-2, 0],
                        [-2, 2],
                        [0, -2],
                        [0, 2],
                        [2, -2],
                        [2, 0],
                        [2, 2],
                    ];

                    // Print black stroke
                    for (const [offsetX, offsetY] of strokeOffsets) {
                        image.print({
                            font: fontBlack,
                            x: offsetX,
                            y: bottomY + offsetY,
                            text: {
                                text: text,
                                alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                            },
                            maxWidth: targetWidth,
                        });
                    }

                    // Print white text on top
                    image.print({
                        font: fontWhite,
                        x: 0,
                        y: bottomY,
                        text: {
                            text: text,
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

            let errorMsg = `❌ Error: ${error.message}\n\n💡 Pastikan reply ke foto!`;

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
