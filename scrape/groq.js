const Groq = require("groq-sdk");
const { searchWeb } = require("./tavily");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

/**
 * Ask Groq AI (tanpa web search)
 */
async function askGroq(question) {
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content:
                        "Kamu adalah asisten AI yang helpful dan ramah. Jawab dengan bahasa Indonesia.",
                },
                {
                    role: "user",
                    content: question,
                },
            ],
            model: "llama-3.1-70b-versatile",
            temperature: 0.7,
            max_tokens: 1024,
        });

        return (
            chatCompletion.choices[0]?.message?.content ||
            "Maaf, tidak ada respon."
        );
    } catch (error) {
        console.error("Error asking Groq:", error);
        throw new Error("Gagal mendapatkan respon dari Groq AI");
    }
}

/**
 * Ask Groq AI dengan Web Search (untuk info terkini)
 */
async function askGroqWithSearch(question) {
    try {
        // 1. Search web dulu untuk dapetin data terkini
        console.log("🔍 Searching web...");
        const searchResults = await searchWeb(question);

        // 2. Kirim hasil search ke Groq untuk di-process
        console.log("🤖 Processing with AI...");
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content:
                        "Kamu adalah asisten AI yang helpful. Jawab pertanyaan user berdasarkan informasi web search yang diberikan. Jawab dengan bahasa Indonesia yang natural dan easy to understand. Sertakan sumber jika relevan.",
                },
                {
                    role: "user",
                    content: `Pertanyaan: ${question}\n\nHasil Web Search:\n${searchResults}\n\nJawab pertanyaan berdasarkan informasi di atas dengan jelas dan ringkas.`,
                },
            ],
            model: "llama-3.1-70b-versatile",
            temperature: 0.7,
            max_tokens: 2048,
        });

        return (
            chatCompletion.choices[0]?.message?.content ||
            "Maaf, tidak ada respon."
        );
    } catch (error) {
        console.error("Error asking Groq with search:", error);
        throw new Error("Gagal mendapatkan respon dari AI");
    }
}

module.exports = { askGroq, askGroqWithSearch };
