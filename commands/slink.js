const { shortenUrl } = require("../scrape/urlshortdev");
const axios = require("axios");

/**
 * Slink command - Shorten URLs with QR code
 * Usage: !slink <url>
 * Examples:
 *   !slink https://google.com
 *   !slink youtube.com
 */
module.exports = {
    name: "slink",
    description: "Shorten URLs and generate QR code",
    category: "utility",

    async execute(yunwa, msg, sender, pushname, args = []) {
        try {
            await yunwa.sendPresenceUpdate("composing", sender);

            // Check if URL is provided
            if (!args || args.length === 0) {
                await yunwa.sendMessage(sender, {
                    text:
                        "❌ *How to use:* !slink <url>\n\n" +
                        "*Examples:*\n" +
                        "• !slink https://google.com\n" +
                        "• !slink youtube.com\n" +
                        "• !slink github.com/user/repo",
                });
                return;
            }

            const url = args[0];

            // Shorten the URL
            const result = await shortenUrl(url);

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
                `*Original:*\n${result.originalUrl}\n\n` +
                `*Short Link:*\n${result.shortUrl}\n\n`;

            // Send QR code image with caption
            await yunwa.sendMessage(sender, {
                image: qrBuffer,
                caption: caption,
            });

            await yunwa.sendPresenceUpdate("paused", sender);
        } catch (error) {
            console.error("Error in slink command:", error);
            await yunwa.sendMessage(sender, {
                text: `❌ ${error.message || "Error occurred while shortening URL"}\n\n💡 Usage: !slink <url>\nExample: !slink google.com`,
            });
        }
    },
};
