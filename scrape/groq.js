const Groq = require("groq-sdk");

let groqClient = null;

/**
 * Get or create Groq client instance (lazy initialization)
 */
function getGroqClient() {
    if (!groqClient) {
        if (!process.env.GROQ_API_KEY) {
            throw new Error(
                "GROQ_API_KEY tidak ditemukan. Jalankan setup wizard atau tambahkan ke file .env",
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

/**
 * Ask Groq AI (tanpa web search)
 */
async function askGroq(question) {
    try {
        const groq = getGroqClient();

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content:
                        "Kamu adalah asisten AI yang helpful dan ramah. Jawab dengan bahasa Indonesia yang natural. Gunakan **bold** untuk penekanan pada kata-kata penting. JANGAN PERNAH gunakan format table atau grid. Selalu jawab dalam bentuk paragraf, list dengan bullet points, atau numbering saja.",
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
 * Ask Groq AI dengan conversation context (untuk follow-up)
 * @param {string} question - User question
 * @param {Array} history - Conversation history
 * @returns {Promise<string>} AI response
 */
async function askGroqWithContext(question, history = []) {
    try {
        const groq = getGroqClient();

        // Build messages array dengan history
        const messages = [
            {
                role: "system",
                content:
                    "Kamu adalah asisten AI yang helpful dan ramah. Jawab dengan bahasa Indonesia yang natural. Gunakan **bold** untuk penekanan pada kata-kata penting. JANGAN PERNAH gunakan format table atau grid. Selalu jawab dalam bentuk paragraf, list dengan bullet points, atau numbering saja.",
            },
            ...history, // Include conversation history
            {
                role: "user",
                content: question,
            },
        ];

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
 * Ask Groq AI dengan Web Search (untuk info terkini)
 */
async function askGroqWithSearch(question, history = []) {
    try {
        const groq = getGroqClient();
        const { searchWeb } = require("./tavily");

        console.log("🔍 Searching web...");
        const searchResults = await searchWeb(question);

        console.log("🤖 Processing with AI...");

        // Build messages dengan history jika ada
        const messages = [
            {
                role: "system",
                content:
                    "Kamu adalah asisten AI yang helpful. Jawab pertanyaan user berdasarkan informasi web search yang diberikan. " +
                    "Jawab dengan bahasa Indonesia yang natural dan easy to understand. " +
                    "PENTING: Ketika menyebutkan sumber, gunakan format '[1]', '[2]', dll yang merujuk ke nomor sumber di hasil pencarian. " +
                    "Di akhir jawaban, tampilkan daftar sumber lengkap dengan URL dalam format yang rapi. " +
                    "Gunakan **bold** untuk penekanan pada informasi penting. " +
                    "JANGAN PERNAH gunakan format table atau grid. Selalu jawab dalam bentuk paragraf, list dengan bullet points, atau numbering saja.",
            },
            ...history, // Include history untuk context
            {
                role: "user",
                content: `Pertanyaan: ${question}\n\nHasil Web Search:\n${searchResults}\n\nJawab pertanyaan berdasarkan informasi di atas. Cite sumber dengan format [1], [2], dll. Di akhir jawaban, tampilkan daftar lengkap semua sumber dengan URL-nya.`,
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
