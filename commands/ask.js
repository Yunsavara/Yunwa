const {
    getHistory,
    addToHistory,
    clearHistory,
} = require("../utils/conversation");

/**
 * Ask command - Chat with AI + Web Search
 * Usage: !ask <pertanyaan>
 * Or reply to bot message for follow-up conversation
 */
module.exports = {
    name: "ask",
    description: "Ask AI with real-time web search (support follow-up)",
    category: "ai",

    async execute(yunwa, msg, sender, pushname) {
        try {
            const body =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                "";

            // Check if this is a reply to bot's message (follow-up)
            const isReply =
                msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            const participant =
                msg.message.extendedTextMessage?.contextInfo?.participant;
            const isReplyToBot = isReply && participant !== sender;

            let question = "";
            let isFollowUp = false;

            if (isReplyToBot && !body.startsWith("!")) {
                // Follow-up conversation (reply to bot)
                question = body.trim();
                isFollowUp = true;
                console.log(`[FOLLOW-UP] ${pushname}: ${question}`);
            } else {
                // New conversation with !ask command
                question = body.slice(4).trim(); // Remove "!ask"
            }

            if (!question) {
                await yunwa.sendMessage(sender, {
                    text:
                        "❌ *Cara pakai:*\n\n" +
                        "*1. Ask baru:*\n" +
                        "!ask <pertanyaan>\n\n" +
                        "*2. Follow-up:*\n" +
                        "Reply pesan bot dengan pertanyaan lanjutan\n\n" +
                        "*Contoh:*\n" +
                        "• !ask apa itu javascript?\n" +
                        "• (reply) contohnya gimana?\n" +
                        "• (reply) bedanya dengan python?\n\n" +
                        "💡 _Conversation akan auto-clear setelah 30 menit idle_",
                });
                return;
            }

            // Check API keys
            if (!process.env.GROQ_API_KEY || !process.env.TAVILY_API_KEY) {
                await yunwa.sendMessage(sender, {
                    text:
                        "❌ *API Keys belum di-setup!*\n\n" +
                        "Untuk menggunakan fitur AI, owner bot harus setup API keys dulu.\n\n" +
                        "🔑 API Keys yang dibutuhkan:\n" +
                        "• Groq: https://console.groq.com/keys\n" +
                        "• Tavily: https://tavily.com/\n\n" +
                        "📖 Restart bot untuk menjalankan setup wizard.",
                });
                return;
            }

            // Kirim typing indicator
            await yunwa.sendPresenceUpdate("composing", sender);

            // Get conversation history
            const history = getHistory(sender);

            // 🔍 DEBUG LOG
            console.log(`[DEBUG] isFollowUp: ${isFollowUp}`);
            console.log(`[DEBUG] History length: ${history.length}`);
            console.log(`[DEBUG] History:`, JSON.stringify(history, null, 2));

            // Lazy load groq module
            const {
                askGroqWithSearch,
                askGroqWithContext,
            } = require("../scrape/groq");

            let response;

            if (isFollowUp && history.length > 0) {
                // Follow-up: Use context without web search (faster)
                console.log(
                    `[CONTEXT] Using ${history.length} previous messages for context`,
                );
                response = await askGroqWithContext(question, history);
            } else {
                // New question: Use web search
                console.log(
                    `[NEW QUESTION] Using web search (history: ${history.length})`,
                );
                response = await askGroqWithSearch(question, history);
            }

            // Add to conversation history
            console.log(`[HISTORY] Adding to history - User: "${question}"`);
            addToHistory(sender, "user", question);
            console.log(
                `[HISTORY] Adding to history - Assistant: "${response.substring(0, 50)}..."`,
            );
            addToHistory(sender, "assistant", response);

            // Verify history saved
            const updatedHistory = getHistory(sender);
            console.log(
                `[HISTORY] Updated history length: ${updatedHistory.length}`,
            );

            // Send response
            await yunwa.sendMessage(sender, {
                text: `${response}\n\n💡 _Reply pesan ini untuk lanjut chat_`,
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
