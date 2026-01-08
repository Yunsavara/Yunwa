const { searchLyrics } = require("../scrape/lrclib");

/**
 * Lyric command - Search and display song lyrics
 * Usage: !lyric <song name>
 */
module.exports = {
    name: "lyric",
    description: "Search song lyrics from LRCLIB",

    async execute(yunwa, msg, sender, pushname) {
        try {
            const body =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                "";

            // Extract query dari command
            const query = body.slice(6).trim(); // Remove "!lyric"

            if (!query) {
                await yunwa.sendMessage(sender, {
                    text:
                        "❌ *Cara pakai:* !lyric <nama lagu>\n\n" +
                        "*Contoh:*\n" +
                        "• !lyric focus hearts2hearts\n" +
                        "• !lyric perfect ed sheeran\n" +
                        "• !lyric bohemian rhapsody",
                });
                return;
            }

            // Kirim typing indicator
            await yunwa.sendPresenceUpdate("composing", sender);

            // Search lyrics
            const result = await searchLyrics(query);

            // Check if plainLyrics exist
            if (!result.plainLyrics || result.plainLyrics.trim() === "") {
                await yunwa.sendMessage(sender, {
                    text: `❌ Lirik tidak tersedia untuk lagu ini.\n\n📝 *${result.trackName}*\n👤 ${result.artistName}`,
                });
                return;
            }

            // Format response
            const response =
                `🎵 *${result.trackName}*\n` +
                `👤 ${result.artistName}\n` +
                `💿 ${result.albumName || "Unknown Album"}\n` +
                `⏱️ ${Math.floor(result.duration / 60)}:${String(Math.floor(result.duration % 60)).padStart(2, "0")}\n\n` +
                `━━━━━━━━━━━━━━\n\n` +
                `${result.plainLyrics}\n\n` +
                `━━━━━━━━━━━━━━\n` +
                `📚 Source: LRCLIB`;

            // Send lyrics
            await yunwa.sendMessage(sender, {
                text: response,
            });

            await yunwa.sendPresenceUpdate("paused", sender);
        } catch (error) {
            console.error("Error in lyric command:", error);
            await yunwa.sendMessage(sender, {
                text: `❌ ${error.message || "Terjadi error saat mencari lirik"}`,
            });
        }
    },
};
