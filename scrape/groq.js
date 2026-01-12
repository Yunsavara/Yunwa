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

async function askGroq(question) {
    try {
        const groq = getGroqClient();

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content:
                        "You are a helpful and friendly AI assistant. " +
                        "Answer clearly and concisely. " +
                        "Use natural language.",
                },
                {
                    role: "user",
                    content: question,
                },
            ],
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

async function checkIfNeedsWebSearch(question, history = []) {
    try {
        const groq = getGroqClient();

        const messages = [
            {
                role: "system",
                content:
                    "Answer YES if the question needs new data from the web. " +
                    "Answer NO if history is sufficient. " +
                    "Answer ONLY: YES or NO",
            },
            ...history.slice(-6),
            {
                role: "user",
                content: `Question: "${question}"\nNeed web search?`,
            },
        ];

        const chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: "openai/gpt-oss-120b",
            temperature: 0.1,
            max_tokens: 5,
        });

        const response =
            chatCompletion.choices[0]?.message?.content?.trim().toUpperCase() ||
            "YES";
        const needsSearch = response.includes("YES");

        console.log(
            `AI evaluated: ${needsSearch ? "Need web search" : "Use context"}`,
        );

        return needsSearch;
    } catch (error) {
        console.error("Error checking if needs web search:", error);
        return true;
    }
}

async function askGroqWithContext(question, history = []) {
    try {
        const groq = getGroqClient();
        const { searchWeb, getLastSearchSources } = require("./tavily");

        // Always perform web search
        console.log("Searching web for context...");
        const searchResults = await searchWeb(question);

        console.log("Processing with AI using history + search...");

        const messages = [
            {
                role: "system",
                content:
                    "You are an AI assistant that answers based on conversation history and web search results. " +
                    "Answer clearly and concisely. " +
                    "Use conversation history if available. " +
                    "Cite sources with [1], [2], [3] when quoting information from the web. " +
                    "Focus on the answer, sources will be added automatically. " +
                    "Use *bold* for important emphasis only.",
            },
            ...history.slice(-6), // Take last 6 messages from history
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

        // Append sources from Tavily
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

async function askGroqWithSearch(question, history = []) {
    try {
        const groq = getGroqClient();
        const { searchWeb } = require("./tavily");

        console.log("Searching web...");
        const searchResults = await searchWeb(question);

        console.log("Processing with AI...");

        const messages = [
            {
                role: "system",
                content:
                    "You are an AI assistant that answers based on web search results. " +
                    "Answer clearly and concisely. Cite sources with [1], [2]. " +
                    "Display source list at the end.",
            },
            ...history.slice(-4), // Take last 4 messages
            {
                role: "user",
                content: `${question}\n\nWeb Search:\n${searchResults}`,
            },
        ];

        const chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: "openai/gpt-oss-120b",
            temperature: 0.3,
            max_tokens: 2048,
        });

        const response =
            chatCompletion.choices[0]?.message?.content ||
            "Sorry, no response available.";

        return convertToWhatsAppFormat(response);
    } catch (error) {
        console.error("Error asking Groq with search:", error);
        if (
            error.message.includes("GROQ_API_KEY") ||
            error.message.includes("TAVILY_API_KEY")
        ) {
            throw error;
        }
        throw new Error("Failed to get response from AI");
    }
}

module.exports = {
    groqClient,
    askGroq,
    askGroqWithContext,
    askGroqWithSearch,
    checkIfNeedsWebSearch,
};
