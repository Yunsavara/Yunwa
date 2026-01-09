const {
    getHistory,
    addToHistory,
    clearHistory,
    registerAskMessage,
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
            } else {
                // New conversation with !ask command
                question = body.slice(4).trim();
            }

            if (!question) {
                await yunwa.sendMessage(sender, {
                    text:
                        "Cara pakai:\n\n" +
                        "1. Ask baru:\n" +
                        "!ask <pertanyaan>\n\n" +
                        "2. Follow-up:\n" +
                        "Reply pesan bot dengan pertanyaan lanjutan\n\n" +
                        "Contoh:\n" +
                        "- !ask apa itu javascript?\n" +
                        "- (reply) contohnya gimana?\n" +
                        "- (reply) bedanya dengan python?",
                });
                return;
            }

            // Check API keys
            if (!process.env.GROQ_API_KEY || !process.env.TAVILY_API_KEY) {
                await yunwa.sendMessage(sender, {
                    text:
                        "API Keys belum di-setup!\n\n" +
                        "API Keys yang dibutuhkan:\n" +
                        "- Groq: https://console.groq.com/keys\n" +
                        "- Tavily: https://tavily.com/\n\n" +
                        "Restart bot untuk menjalankan setup wizard.",
                });
                return;
            }

            await yunwa.sendPresenceUpdate("composing", sender);

            // Get conversation history
            const history = getHistory(sender);

            // Lazy load groq module
            const {
                askGroqWithSearch,
                askGroqWithContext,
            } = require("../scrape/groq");

            let response;

            if (isFollowUp && history.length > 0) {
                // Follow-up: Use context without web search (faster)
                response = await askGroqWithContext(question, history);
            } else {
                // New question: Use web search
                response = await askGroqWithSearch(question, history);
            }

            // Add to conversation history
            addToHistory(sender, "user", question);
            addToHistory(sender, "assistant", response);

            // Send response and register message ID for follow-up tracking
            const sentMsg = await yunwa.sendMessage(sender, {
                text: response,
            });

            // Register this message as ask command response
            if (sentMsg && sentMsg.key && sentMsg.key.id) {
                registerAskMessage(sentMsg.key.id);
            }

            await yunwa.sendPresenceUpdate("paused", sender);
        } catch (error) {
            console.error("Error in ask command:", error);
            await yunwa.sendMessage(sender, {
                text: error.message || "Terjadi error saat menghubungi AI",
            });
        }
    },
};
