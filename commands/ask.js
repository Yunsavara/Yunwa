const {
    getHistory,
    addToHistory,
    clearHistory,
    registerAskMessage,
} = require("../utils/conversation");

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

            const isReply =
                msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            const participant =
                msg.message.extendedTextMessage?.contextInfo?.participant;
            const isReplyToBot = isReply && participant !== sender;

            let question = "";
            let isFollowUp = false;

            if (isReplyToBot && !body.startsWith("!")) {
                question = body.trim();
                isFollowUp = true;
            } else {
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
                        "- !ask siapa itu Castorice?\n" +
                        "- (reply) contohnya gimana?\n" +
                        "- (reply) benarkah itu?",
                });
                return;
            }

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

            const history = getHistory(sender);

            const {
                askGroqWithSearch,
                askGroqWithContext,
                checkIfNeedsWebSearch,
            } = require("../scrape/groq");

            let response;

            if (isFollowUp && history.length > 0) {
                // AI self-assess: Does it need web search?
                console.log("AI checking if web search needed...");
                const needsSearch = await checkIfNeedsWebSearch(
                    question,
                    history,
                );

                if (needsSearch) {
                    console.log("AI decided: NEED web search");
                    response = await askGroqWithSearch(question, history);
                } else {
                    console.log("AI decided: Context is enough");
                    response = await askGroqWithContext(question, history);
                }
            } else {
                // New question: Always use web search
                response = await askGroqWithSearch(question, history);
            }

            addToHistory(sender, "user", question);
            addToHistory(sender, "assistant", response);

            const sentMsg = await yunwa.sendMessage(sender, {
                text: response,
            });

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
