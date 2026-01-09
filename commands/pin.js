const { searchPinterest } = require("../scrape/pinterest");
const axios = require("axios");

/**
 * Pinterest command - Search and display a random Pinterest image
 * Usage: !pin <query>
 */
module.exports = {
    name: "pin",
    description: "Cari gambar dari Pinterest (via Resita API)",
    category: "media",

    async execute(yunwa, msg, sender, pushname) {
        try {
            const body =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                "";

            const query = body.slice(4).trim(); // Remove "!pin"

            if (!query) {
                await yunwa.sendMessage(sender, {
                    text:
                        "❌ *Cara pakai:* !pin <kata kunci>\n\n" +
                        "*Contoh:*\n" +
                        "• !pin aesthetic anime\n" +
                        "• !pin nmixx kim jiwoo\n",
                });
                return;
            }

            await yunwa.sendPresenceUpdate("composing", sender);

            const imageUrl = await searchPinterest(query);

            // Download image
            const imageResponse = await axios.get(imageUrl, {
                responseType: "arraybuffer",
            });
            const imageBuffer = Buffer.from(imageResponse.data, "binary");

            await yunwa.sendMessage(sender, {
                image: imageBuffer,
                caption: `*${query}*`,
            });

            await yunwa.sendPresenceUpdate("paused", sender);
        } catch (error) {
            console.error("Error in pin command:", error);
            await yunwa.sendMessage(sender, {
                text: `❌ ${error.message || "Terjadi error saat mencari gambar Pinterest"}`,
            });
        }
    },
};
