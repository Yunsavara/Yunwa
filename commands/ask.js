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

            // Check API keys before processing
            if (!process.env.GROQ_API_KEY || !process.env.TAVILY_API_KEY) {
                await yunwa.sendMessage(sender, {
                    text:
                        "❌ *API Keys belum di-setup!*\n\n" +
                        "Untuk menggunakan fitur AI, owner bot harus setup API keys dulu.\n\n" +
                        "🔑 API Keys yang dibutuhkan (100% GRATIS):\n" +
                        "• Groq: https://console.groq.com/keys\n" +
                        "• Tavily: https://tavily.com/\n\n" +
                        "📖 Restart bot untuk menjalankan setup wizard.",
                });
                return;
            }

            // Kirim notif sedang proses
            await yunwa.sendMessage(sender, {
                text: "🔍 LET MI TING...",
            });

            // Kirim typing indicator
            await yunwa.sendPresenceUpdate("composing", sender);

            // Lazy load groq module (only when actually used)
            const { askGroqWithSearch } = require("../scrape/groq");

            // Ask AI dengan web search
            const response = await askGroqWithSearch(question);

            // Send response
            await yunwa.sendMessage(sender, {
                text: `${response}`,
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
