const { getLyrics } = require("../scrape/lyricsovh");

/**
 * Lyrics command - Get song lyrics
 * Usage: !lyrics <artist> - <title>
 */
module.exports = {
    name: "lyrics",
    description: "Get song lyrics by artist and title",

    async execute(yunwa, msg, sender, pushname) {
        try {
            const body =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                "";

            // Extract query dari command
            // Format: !lyrics artist - title
            const query = body.slice(7).trim(); // Remove "!lyrics"

            if (!query) {
                await yunwa.sendMessage(sender, {
                    text:
                        "❌ *Cara pakai:* !lyrics <artist> - <title>\n\n" +
                        "*Contoh:*\n" +
                        "• !lyrics The Beatles - Hey Jude\n" +
                        "• !lyrics Coldplay - Fix You\n" +
                        "• !lyrics Ed Sheeran - Shape of You\n\n" +
                        "_Gunakan tanda '-' untuk memisahkan artist dan judul lagu_",
                });
                return;
            }

            // Split artist dan title dengan separator " - "
            const parts = query.split(" - ");

            if (parts.length < 2) {
                await yunwa.sendMessage(sender, {
                    text:
                        "❌ *Format salah!*\n\n" +
                        "Gunakan format: !lyrics <artist> - <title>\n\n" +
                        "*Contoh:*\n" +
                        "!lyrics Coldplay - Yellow",
                });
                return;
            }

            const artist = parts[0].trim();
            const title = parts.slice(1).join(" - ").trim(); // Handle jika ada " - " di judul

            if (!artist || !title) {
                await yunwa.sendMessage(sender, {
                    text: "❌ Artist atau judul lagu tidak boleh kosong!",
                });
                return;
            }

            // Kirim typing indicator
            await yunwa.sendPresenceUpdate("composing", sender);

            // Fetch lyrics
            const lyrics = await getLyrics(artist, title);

            // Truncate jika terlalu panjang (WhatsApp limit ~65KB per message)
            const maxLength = 4000; // Batasi 4000 karakter
            let lyricsToSend = lyrics;
            let isTruncated = false;

            if (lyrics.length > maxLength) {
                lyricsToSend = lyrics.substring(0, maxLength);
                isTruncated = true;
            }

            // Format response
            const response =
                `🎵 *${title}*\n` +
                `👤 *${artist}*\n` +
                `${"─".repeat(30)}\n\n` +
                `${lyricsToSend}\n\n` +
                (isTruncated
                    ? "_⚠️ Lyrics terlalu panjang, hanya sebagian yang ditampilkan_\n\n"
                    : "") +
                `_Source: lyrics.ovh_`;

            // Send lyrics
            await yunwa.sendMessage(sender, {
                text: response,
            });

            await yunwa.sendPresenceUpdate("paused", sender);
        } catch (error) {
            console.error("Error in lyrics command:", error);
            await yunwa.sendMessage(sender, {
                text: `❌ ${error.message || "Terjadi error saat mencari lyrics"}`,
            });
            await yunwa.sendPresenceUpdate("paused", sender);
        }
    },
};
