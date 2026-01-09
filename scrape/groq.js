const Groq = require("groq-sdk");

let groqClient = null;

/**
 * Get or create Groq client instance (lazy initialization)
 */
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

/**
 * Convert markdown formatting to WhatsApp formatting
 */
function convertToWhatsAppFormat(text) {
    return (
        text
            // Remove tables
            .replace(/\|[\s\S]*?\|/g, "")
            .replace(/[\-]{3,}/g, "")
            // Convert bold
            .replace(/\*\*\*(.*?)\*\*\*/g, "*$1*")
            .replace(/\*\*(.*?)\*\*/g, "*$1*")
            // Convert italic
            .replace(/\_\_(.*?)\_\_/g, "_$1_")
            // Strikethrough
            .replace(/\~\~(.*?)\~\~/g, "~$1~")
            // Remove code blocks
            .replace(/\`\`\`[\s\S]*?\`\`\`/g, "")
            .replace(/\`(.*?)\`/g, "$1")
            // Convert links
            .replace(/\[(.*?)\]\((.*?)\)/g, "$1: $2")
            // Remove headers
            .replace(/^#+\s/gm, "")
            // Clean up newlines
            .replace(/\n{3,}/g, "\n\n")
            .trim()
    );
}

/**
 * Ask Groq AI (without web search)
 */
async function askGroq(question) {
    try {
        const groq = getGroqClient();

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content:
                        "Kamu adalah asisten AI yang helpful dan ramah. Jawab dengan bahasa Indonesia yang natural. Gunakan bold untuk penekanan. Jangan gunakan format table. Gunakan paragraf, bullet points, atau numbering.",
                },
                {
                    role: "user",
                    content: question,
                },
            ],
            model: "openai/gpt-oss-120b",
            temperature: 0.7,
            max_tokens: 1024,
        });

        const response =
            chatCompletion.choices[0]?.message?.content ||
            "Maaf, tidak ada respon.";

        return convertToWhatsAppFormat(response);
    } catch (error) {
        console.error("Error asking Groq:", error);
        if (error.message.includes("GROQ_API_KEY")) {
            throw error;
        }
        throw new Error("Gagal mendapatkan respon dari Groq AI");
    }
}

/**
 * Ask Groq AI with conversation context (for follow-up)
 */
async function askGroqWithContext(question, history = []) {
    try {
        const groq = getGroqClient();

        const messages = [
            {
                role: "system",
                content:
                    "Kamu adalah asisten AI yang helpful dan ramah. Jawab dengan bahasa Indonesia yang natural. Gunakan bold untuk penekanan. Jangan gunakan format table. Gunakan paragraf, bullet points, atau numbering.",
            },
            ...history,
            {
                role: "user",
                content: question,
            },
        ];

        console.log(`Processing with context (${history.length} messages)`);

        const chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: "openai/gpt-oss-120b",
            temperature: 0.7,
            max_tokens: 1024,
        });

        const response =
            chatCompletion.choices[0]?.message?.content ||
            "Maaf, tidak ada respon.";

        return convertToWhatsAppFormat(response);
    } catch (error) {
        console.error("Error asking Groq with context:", error);
        throw new Error("Gagal mendapatkan respon dari Groq AI");
    }
}

/**
 * Ask Groq AI with Web Search (for latest info)
 */
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
                    "Kamu adalah asisten AI yang helpful. Jawab pertanyaan berdasarkan hasil web search. " +
                    "Jawab dengan bahasa Indonesia yang natural. " +
                    "Cite sumber dengan format [1], [2], dll. " +
                    "Tampilkan daftar sumber lengkap dengan URL di akhir. " +
                    "Gunakan bold untuk penekanan. Jangan gunakan table.",
            },
            ...history,
            {
                role: "user",
                content: `Pertanyaan: ${question}\n\nHasil Web Search:\n${searchResults}\n\nJawab berdasarkan informasi di atas. Cite sumber dengan [1], [2], dll. Tampilkan daftar sumber dengan URL di akhir.`,
            },
        ];

        const chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: "openai/gpt-oss-120b",
            temperature: 0.7,
            max_tokens: 2048,
        });

        const response =
            chatCompletion.choices[0]?.message?.content ||
            "Maaf, tidak ada respon.";

        return convertToWhatsAppFormat(response);
    } catch (error) {
        console.error("Error asking Groq with search:", error);
        if (
            error.message.includes("GROQ_API_KEY") ||
            error.message.includes("TAVILY_API_KEY")
        ) {
            throw error;
        }
        throw new Error("Gagal mendapatkan respon dari AI");
    }
}

module.exports = { askGroq, askGroqWithContext, askGroqWithSearch };
