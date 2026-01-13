const Groq = require("groq-sdk");

let groqClient = null;

function getGroqClient() {
    if (!groqClient) {
        if (!process.env.GROQ_API_KEY) {
            throw new Error(
                "GROQ_API_KEY not found. Run setup wizard or add to .env file",
            );
        }
        groqClient = new Groq({
            apiKey: process.env.GROQ_API_KEY,
        });
    }
    return groqClient;
}

function convertToWhatsAppFormat(text) {
    return text
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/\|[\s\S]*?\|/g, "")
        .replace(/[\-]{3,}/g, "")
        .replace(/\*\*\*(.*?)\*\*\*/g, "*$1*")
        .replace(/\*\*(.*?)\*\*/g, "*$1*")
        .replace(/\_\_(.*?)\_\_/g, "_$1_")
        .replace(/\~\~(.*?)\~\~/g, "~$1~")
        .replace(/\`\`\`[\s\S]*?\`\`\`/g, "")
        .replace(/\`(.*?)\`/g, "$1")
        .replace(/\[(.*?)\]\((.*?)\)/g, "$1: $2")
        .replace(/^#+\s/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/【[^】]*】/g, "")
        .replace(/[†‡§¶]/g, "")
        .trim();
}

/**
 * Simple Groq response without web search
 * Only uses conversation history and LLM knowledge
 * Used for: conversational questions, follow-ups, general knowledge
 */
async function askGroqSimple(question, history = []) {
    try {
        const groq = getGroqClient();

        console.log("Groq: Answering with history only (no search)");

        const messages = [
            {
                role: "system",
                content:
                    "You are Yunwa, a helpful and friendly WhatsApp AI assistant. " +
                    "You were created by Yunsavara, a developer who built you to help people through WhatsApp conversations. " +
                    "You can answer questions, search the web for current information, and have natural conversations. " +
                    "Your capabilities include:\n" +
                    "- Answering general questions using your knowledge\n" +
                    "- Searching the web for time-sensitive or specific information\n" +
                    "- Having natural, friendly conversations\n" +
                    "- Helping with various tasks and queries\n\n" +
                    "When asked about yourself, explain that you are Yunwa, created by Yunsavara. " +
                    "Answer clearly and concisely. " +
                    "Use *bold* for important emphasis only. " +
                    "Use natural language and be friendly.",
            },
            ...history.slice(-6),
            {
                role: "user",
                content: question,
            },
        ];

        const chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: "openai/gpt-oss-120b",
            temperature: 0.5,
            max_tokens: 1500,
        });

        const response =
            chatCompletion.choices[0]?.message?.content ||
            "Sorry, no response available.";

        return convertToWhatsAppFormat(response);
    } catch (error) {
        console.error("Error asking Groq:", error);
        if (error.message.includes("GROQ_API_KEY")) {
            throw error;
        }
        throw new Error("Failed to get response from Groq AI");
    }
}

/**
 * Groq response with web search context
 * Searches the web first, then answers using search results + conversation history
 * Used for: time-sensitive questions, specific queries, news, current events
 */
async function askGroqWithContext(question, history = []) {
    try {
        const groq = getGroqClient();
        const { searchWeb, getLastSearchSources } = require("./tavily");

        console.log("Tavily: Searching web for context...");
        const searchResults = await searchWeb(question);

        console.log("Groq: Answering with history + search context");

        const messages = [
            {
                role: "system",
                content:
                    "You are Yunwa, an AI assistant created by Yunsavara. " +
                    "You answer based on conversation history and web search results. " +
                    "Answer clearly and concisely. " +
                    "Use conversation history if available. " +
                    "Cite sources with [1], [2], [3] when quoting information from the web. " +
                    "Focus on the answer, sources will be added automatically. " +
                    "Use *bold* for important emphasis only.",
            },
            ...history.slice(-6),
            {
                role: "user",
                content: `${question}\n\nWeb Search Results:\n${searchResults}`,
            },
        ];

        const chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: "openai/gpt-oss-120b",
            temperature: 0.3,
            max_tokens: 2048,
        });

        let response =
            chatCompletion.choices[0]?.message?.content ||
            "Sorry, no response available.";

        const sources = getLastSearchSources();
        if (sources && sources.length > 0) {
            response += "\n─────────────\n*Sources:*\n";
            sources.forEach((source, index) => {
                response += `[${index + 1}] ${source.title}\n${source.url}\n\n`;
            });
        }

        return convertToWhatsAppFormat(response);
    } catch (error) {
        console.error("Error asking Groq with context:", error);
        if (
            error.message.includes("GROQ_API_KEY") ||
            error.message.includes("TAVILY_API_KEY")
        ) {
            throw error;
        }
        throw new Error("Failed to get response from Groq AI");
    }
}

module.exports = {
    groqClient,
    askGroqSimple,
    askGroqWithContext,
};
