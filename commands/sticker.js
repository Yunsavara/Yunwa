const sharp = require("sharp");
const axios = require("axios");

/**
 * Sticker command - Convert image to WhatsApp sticker with optional text
 * Usage: !sticker [top:text] [bottom:text]
 * Examples:
 *   !sticker (reply to image)
 *   !sticker top:Hello
 *   !sticker bottom:World
 *   !sticker top:Hello bottom:World
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
                        "• !sticker top:Hello\n" +
                        "• !sticker bottom:World\n" +
                        "• !sticker top:Hello bottom:World\n\n" +
                        "⚠️ Max 30 characters per text",
                });
                return;
            }

            // Parse text options
            let topText = null;
            let bottomText = null;

            if (args && args.length > 0) {
                for (const arg of args) {
                    if (arg.startsWith("top:")) {
                        topText = arg.slice(4).trim();
                        if (topText.length > 30) {
                            await yunwa.sendMessage(sender, {
                                text: "❌ Top text must be 30 characters or less!",
                            });
                            return;
                        }
                    } else if (arg.startsWith("bottom:")) {
                        bottomText = arg.slice(7).trim();
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

            // Process image with sharp
            let image = sharp(imageBuffer);

            // Get image metadata
            const metadata = await image.metadata();
            const { width, height } = metadata;

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
            image = image.resize(targetWidth, targetHeight, {
                fit: "contain",
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            });

            // Add text overlays if specified
            if (topText || bottomText) {
                const svgOverlay = await createTextOverlay(
                    topText,
                    bottomText,
                    targetWidth,
                    targetHeight,
                );

                image = image.composite([
                    {
                        input: Buffer.from(svgOverlay),
                        top: 0,
                        left: 0,
                    },
                ]);
            }

            // Convert to WebP format (sticker format)
            const stickerBuffer = await image.webp({ quality: 95 }).toBuffer();

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

/**
 * Create SVG overlay with text
 * @param {string} topText - Text to display at top
 * @param {string} bottomText - Text to display at bottom
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {string} SVG markup
 */
function createTextOverlay(topText, bottomText, width, height) {
    const fontSize = 40;
    const padding = 10;
    const strokeWidth = 3;

    let svgElements = [];

    // Add top text
    if (topText) {
        svgElements.push(`
            <text
                x="50%"
                y="${fontSize + padding}"
                font-family="Impact, Arial Black, sans-serif"
                font-size="${fontSize}"
                font-weight="900"
                fill="white"
                stroke="black"
                stroke-width="${strokeWidth}"
                text-anchor="middle"
                dominant-baseline="hanging"
            >${escapeXml(topText.toUpperCase())}</text>
        `);
    }

    // Add bottom text
    if (bottomText) {
        svgElements.push(`
            <text
                x="50%"
                y="${height - padding}"
                font-family="Impact, Arial Black, sans-serif"
                font-size="${fontSize}"
                font-weight="900"
                fill="white"
                stroke="black"
                stroke-width="${strokeWidth}"
                text-anchor="middle"
                dominant-baseline="auto"
            >${escapeXml(bottomText.toUpperCase())}</text>
        `);
    }

    return `
        <svg width="${width}" height="${height}">
            ${svgElements.join("\n")}
        </svg>
    `;
}

/**
 * Escape XML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeXml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
