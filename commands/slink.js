const { shortenUrl } = require("../scrape/urlshortdev");
const axios = require("axios");

/**
 * Slink command - Shorten URLs with optional QR code
 * Usage: !slink <url> [qr]
 * Examples:
 *   !slink https://google.com
 *   !slink youtube.com qr
 */
module.exports = {
    name: "slink",
    description: "Shorten URLs with optional QR code generation",
    category: "utility",

    async execute(yunwa, msg, sender, pushname, args = []) {
        try {
            await yunwa.sendPresenceUpdate("composing", sender);

            // Check if URL is provided
            if (!args || args.length === 0) {
                await yunwa.sendMessage(sender, {
                    text:
                        "❌ *How to use:* !slink <url> [qr]\n\n" +
                        "*Examples:*\n" +
                        "• !slink https://google.com\n" +
                        "• !slink youtube.com qr\n" +
                        "• !slink github.com/user/repo qr\n\n" +
                        "💡 Add 'qr' at the end to generate QR code",
                });
                return;
            }

            // Extract URL and check for QR option
            const url = args[0];
            const generateQR =
                args.length > 1 && args[1].toLowerCase() === "qr";

            // Shorten the URL
            const result = await shortenUrl(url);

            if (!generateQR) {
                // Send only shortened URL
                const response =
                    `✅ *Link shortened successfully!*\n\n` +
                    `*Original:*\n${result.originalUrl}\n\n` +
                    `*Short Link:*\n${result.shortUrl}`;

                await yunwa.sendMessage(sender, {
                    text: response,
                });
            } else {
                // Generate QR code
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(result.shortUrl)}`;

                // Download QR code image
                const qrResponse = await axios.get(qrUrl, {
                    responseType: "arraybuffer",
                    timeout: 10000,
                });

                const qrBuffer = Buffer.from(qrResponse.data, "binary");

                const caption =
                    `✅ *Link shortened successfully!*\n\n` +
                    `*Original:*\n${result.originalUrl}`;

                // Send QR code image with caption
                await yunwa.sendMessage(sender, {
                    image: qrBuffer,
                    caption: caption,
                });
            }

            await yunwa.sendPresenceUpdate("paused", sender);
        } catch (error) {
            console.error("Error in slink command:", error);
            await yunwa.sendMessage(sender, {
                text: `❌ ${error.message || "Error occurred while shortening URL"}\n\n💡 Usage: !slink <url> [qr]\nExample: !slink google.com`,
            });
        }
    },
};
