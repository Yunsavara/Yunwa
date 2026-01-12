const { getRandomWaifu } = require("../scrape/waifuim");
const axios = require("axios");

/**
 * Waifu command - Get random waifu image
 * Usage: !waifu
 */
module.exports = {
    name: "waifu",
    description: "Get random waifu image",
    category: "media",

    async execute(yunwa, msg, sender, pushname) {
        try {
            // Send typing indicator
            await yunwa.sendPresenceUpdate("composing", sender);

            // Get random waifu
            const waifu = await getRandomWaifu();

            // Download image
            const imageResponse = await axios.get(waifu.url, {
                responseType: "arraybuffer",
            });
            const imageBuffer = Buffer.from(imageResponse.data, "binary");

            // Caption
            const caption =
                `Hey *${pushname}*, here's your waifu!\n\n` +
                `Artist: ${waifu.artist}\n` +
                (waifu.source ? `Source: ${waifu.source}\n` : "");

            // Send image with caption
            await yunwa.sendMessage(sender, {
                image: imageBuffer,
                caption: caption,
            });

            await yunwa.sendPresenceUpdate("paused", sender);
        } catch (error) {
            console.error("Error in waifu command:", error);
            await yunwa.sendMessage(sender, {
                text: `❌ ${error.message || "Error occurred while fetching waifu"}`,
            });
        }
    },
};
