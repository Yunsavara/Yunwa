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
                        "Kamu asisten AI yang helpful dan ramah. " +
                        "Jawab dengan jelas dan padat. " +
                        "Gunakan bahasa Indonesia yang natural.",
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

async function checkIfNeedsWebSearch(question, history = []) {
    try {
        const groq = getGroqClient();

        const messages = [
            {
                role: "system",
                content:
                    "Jawab YES jika pertanyaan butuh data baru dari web. " +
                    "Jawab NO jika cukup dari history. " +
                    "Jawab HANYA: YES atau NO",
            },
            ...history.slice(-6),
            {
                role: "user",
                content: `Pertanyaan: "${question}"\nButuh web search?`,
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

        // Selalu lakukan web search
        console.log("Searching web for context...");
        const searchResults = await searchWeb(question);

        console.log("Processing with AI using history + search...");

        const messages = [
            {
                role: "system",
                content:
                    "Kamu asisten AI yang menjawab berdasarkan konteks history dan web search. " +
                    "Jawab jelas dan padat dalam bahasa Indonesia. " +
                    "Gunakan konteks history jika ada. " +
                    "Cite sumber dengan [1], [2], [3] saat mengutip informasi dari web. " +
                    "Fokus pada jawaban, sumber akan ditambahkan otomatis jika belum ada. " +
                    "Gunakan *bold* untuk penekanan penting saja.",
            },
            ...history.slice(-6), // Ambil 6 message terakhir dari history
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
            "Maaf, tidak ada respon.";

        // Cek apakah AI sudah mencantumkan sumber
        const hasSourceSection =
            response.includes("─────────────") ||
            response.match(/\*Sumber[:\s]*\*/i) ||
            response.match(/Sumber[:\s]*\n\[/);

        // Append sumber dari Tavily hanya jika AI belum mencantumkan
        if (!hasSourceSection) {
            const sources = getLastSearchSources();
            if (sources && sources.length > 0) {
                response += "\n─────────────\n*Sumber:*\n";
                sources.forEach((source, index) => {
                    response += `[${index + 1}] ${source.title}\n${source.url}\n\n`;
                });
            }
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
        throw new Error("Gagal mendapatkan respon dari Groq AI");
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
                    "Kamu asisten AI yang menjawab berdasarkan web search. " +
                    "Jawab jelas dan padat. Cite sumber dengan [1], [2]. " +
                    "Tampilkan daftar sumber di akhir.",
            },
            ...history.slice(-4), // Ambil 4 message terakhir
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

module.exports = {
    groqClient,
    askGroq,
    askGroqWithContext,
    askGroqWithSearch,
    checkIfNeedsWebSearch,
};
