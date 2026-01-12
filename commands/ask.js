const {
    getHistory,
    addToHistory,
    clearHistory,
    registerAskMessage,
} = require("../utils/conversation");

module.exports = {
    name: "ask",
    description: "Ask AI with real-time web search",
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
                        "How to use:\n\n" +
                        "1. New question:\n" +
                        "!ask <question>\n\n" +
                        "2. Follow-up:\n" +
                        "Reply to bot message with follow-up question\n\n" +
                        "Examples:\n" +
                        "- !ask who is Castorice?\n" +
                        "- (reply) can you give me an example?\n" +
                        "- (reply) is that true?",
                });
                return;
            }

            if (!process.env.GROQ_API_KEY || !process.env.TAVILY_API_KEY) {
                await yunwa.sendMessage(sender, {
                    text:
                        "API Keys not configured!\n\n" +
                        "Required API Keys:\n" +
                        "- Groq: https://console.groq.com/keys\n" +
                        "- Tavily: https://tavily.com/\n\n" +
                        "Restart bot to run setup wizard.",
                });
                return;
            }

            await yunwa.sendPresenceUpdate("composing", sender);

            const history = getHistory(sender);
            const { askGroqWithContext } = require("../scrape/groq");

            // Always use askGroqWithContext (search + history)
            const response = await askGroqWithContext(question, history);

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
                text: error.message || "Error occurred while contacting AI",
            });
        }
    },
};
