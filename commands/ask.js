const { askGroqWithSearch } = require("../scrape/groq");

/**
 * Ask command - Chat with AI + Web Search
 * Usage: !ask <pertanyaan>
 */
module.exports = {
    name: "ask",
    description: "Ask AI with real-time web search",

    async execute(yunwa, msg, sender, pushname) {
        try {
            const body =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                "";

            // Extract question dari command
            const question = body.slice(4).trim(); // Remove "!ask"

            if (!question) {
                await yunwa.sendMessage(sender, {
                    text: "❌ *Cara pakai:* !ask <pertanyaan>\n\n*Contoh:*\n• !ask siapa presiden indonesia saat ini?\n• !ask harga bitcoin hari ini\n• !ask berita terkini tentang AI",
                });
                return;
            }

            // Kirim notif sedang proses
            await yunwa.sendMessage(sender, {
                text: "🔍 Mencari informasi terkini...",
            });

            // Kirim typing indicator
            await yunwa.sendPresenceUpdate("composing", sender);

            // Ask AI dengan web search
            const response = await askGroqWithSearch(question);

            // Send response
            await yunwa.sendMessage(sender, {
                text: `🤖 *AI Assistant* (with web search)\n\n${response}`,
            });

            await yunwa.sendPresenceUpdate("paused", sender);
        } catch (error) {
            console.error("Error in ask command:", error);
            await yunwa.sendMessage(sender, {
                text: `❌ ${error.message || "Terjadi error saat menghubungi AI"}`,
            });
        }
    },
};
