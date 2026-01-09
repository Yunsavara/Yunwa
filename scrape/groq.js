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
 * Ask AI to self-assess if it needs web search
 * AI will return "NEED_SEARCH" if it's uncertain or topic is too new
 */
async function checkIfNeedsWebSearch(question, history = []) {
    try {
        const groq = getGroqClient();

        const today = new Date().toLocaleDateString("id-ID", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });

        const messages = [
            {
                role: "system",
                content:
                    `Kamu adalah AI assistant. Tanggal hari ini: ${today}. ` +
                    `Knowledge cutoff kamu: Oktober 2023. ` +
                    `Tugas: Tentukan apakah kamu BUTUH web search untuk menjawab pertanyaan dengan akurat. ` +
                    `Balas HANYA dengan "YES" atau "NO". ` +
                    `Balas "YES" jika: ` +
                    `1. Pertanyaan tentang info terkini (harga, berita, update setelah Oktober 2023) ` +
                    `2. Kamu tidak yakin atau tidak tahu jawabannya ` +
                    `3. Pertanyaan tentang data real-time (cuaca, saham, dll) ` +
                    `4. Fact-checking atau verifikasi ` +
                    `Balas "NO" jika kamu yakin bisa jawab dengan knowledge yang ada.`,
            },
            ...history,
            {
                role: "user",
                content: `Pertanyaan: "${question}"\n\nApakah kamu butuh web search? Jawab HANYA: YES atau NO`,
            },
        ];

        const chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: "openai/gpt-oss-120b",
            temperature: 0.1,
            max_tokens: 10,
        });

        const response =
            chatCompletion.choices[0]?.message?.content?.trim().toUpperCase() ||
            "NO";

        return response.includes("YES");
    } catch (error) {
        console.error("Error checking if needs web search:", error);
        return false;
    }
}

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

module.exports = {
    askGroq,
    askGroqWithContext,
    askGroqWithSearch,
    checkIfNeedsWebSearch,
};
