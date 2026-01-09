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

        // Deteksi jika input cuma konfirmasi/reaksi singkat
        const shortResponses = [
            "iya",
            "oh",
            "oke",
            "ok",
            "wah",
            "hmm",
            "ic",
            "i see",
            "emang",
            "memang",
            "bener",
            "betul",
            "sip",
        ];
        const isShortResponse =
            question.trim().split(/\s+/).length <= 3 &&
            shortResponses.some((word) =>
                question.toLowerCase().includes(word),
            );

        const systemContent = isShortResponse
            ? "Kamu asisten AI. User baru saja memberi reaksi singkat/konfirmasi. " +
              "Jangan jelaskan hal yang tidak ditanyakan. " +
              "Cukup respon natural dan tunggu pertanyaan berikutnya jika ada."
            : "Kamu asisten AI yang menjawab dengan jelas dan padat. " +
              "Fokus pada pertanyaan user. Gunakan konteks sebelumnya jika relevan. " +
              "Jawab dalam bahasa Indonesia. Gunakan *bold* untuk penekanan penting saja.";

        const messages = [
            {
                role: "system",
                content: systemContent,
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
            temperature: 0.3,
            max_tokens: isShortResponse ? 150 : 1500, // Batasi token untuk response singkat
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
    askGroq,
    askGroqWithContext,
    askGroqWithSearch,
    checkIfNeedsWebSearch,
};
