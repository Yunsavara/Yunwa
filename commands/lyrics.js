const { searchLyrics } = require("../scrape/lrclib");

/**
 * Lyrics command - Search and display song lyrics
 * Usage: !lyrics <song name>
 */
module.exports = {
    name: "lyrics",
    description: "Search song lyrics from LRCLIB",

    async execute(yunwa, msg, sender, pushname) {
        try {
            const body =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                "";

            // Extract query from command
            const query = body.slice(7).trim(); // Remove "!lyrics"

            if (!query) {
                await yunwa.sendMessage(sender, {
                    text:
                        "❌ *How to use:* !lyrics <song name>\n\n" +
                        "*Examples:*\n" +
                        "• !lyrics focus hearts2hearts\n" +
                        "• !lyrics perfect ed sheeran\n" +
                        "• !lyrics bohemian rhapsody",
                });
                return;
            }

            // Send typing indicator
            await yunwa.sendPresenceUpdate("composing", sender);

            // Search lyrics
            const result = await searchLyrics(query);

            // Check if plainLyrics exist
            if (!result.plainLyrics || result.plainLyrics.trim() === "") {
                await yunwa.sendMessage(sender, {
                    text: `❌ Lyrics not available for this song.\n\n📝 *${result.trackName}*\n👤 ${result.artistName}`,
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
            console.error("Error in lyrics command:", error);
            await yunwa.sendMessage(sender, {
                text: `❌ ${error.message || "Error occurred while searching lyrics"}`,
            });
        }
    },
};
