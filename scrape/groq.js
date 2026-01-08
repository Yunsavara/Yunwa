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
 * WhatsApp format:
 * - *bold* (single asterisk)
 * - _italic_ (underscore)
 * - ~strikethrough~ (tilde)
 * - ```monospace``` (triple backticks)
 */
function convertToWhatsAppFormat(text) {
    return (
        text
            // REMOVE TABLES - hapus semua tabel markdown
            .replace(/\|[\s\S]*?\|/g, "") // Hapus table dengan | pipes
            .replace(/[\-]{3,}/g, "") // Hapus separator line (---)

            // Convert **bold** atau ***bold*** menjadi *bold* (WhatsApp)
            .replace(/\*\*\*(.*?)\*\*\*/g, "*$1*") // ***text*** → *text*
            .replace(/\*\*(.*?)\*\*/g, "*$1*") // **text** → *text*

            // Convert __italic__ menjadi _italic_ (WhatsApp)
            .replace(/\_\_(.*?)\_\_/g, "_$1_") // __text__ → _text_

            // Strikethrough sudah sama: ~~text~~ → ~text~
            .replace(/\~\~(.*?)\~\~/g, "~$1~") // ~~text~~ → ~text~

            // Remove code blocks dan inline code
            .replace(/\`\`\`[\s\S]*?\`\`\`/g, "") // Hapus ```code blocks```
            .replace(/\`(.*?)\`/g, "$1") // `code` → code

            // Convert [text](link) menjadi text: link
            .replace(/\[(.*?)\]\((.*?)\)/g, "$1: $2") // [text](link) → text: link

            // Remove headers markdown
            .replace(/^#+\s/gm, "") // # Header → Header

            // Clean up multiple newlines
            .replace(/\n{3,}/g, "\n\n") // Max 2 newlines

            .trim()
    );
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

        // Convert markdown ke WhatsApp format
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
 * Ask Groq AI dengan Web Search (untuk info terkini)
 */
async function askGroqWithSearch(question) {
    try {
        const groq = getGroqClient();

        // Import searchWeb only when needed
        const { searchWeb } = require("./tavily");

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
                        "Kamu adalah asisten AI yang helpful. Jawab pertanyaan user berdasarkan informasi web search yang diberikan. " +
                        "Jawab dengan bahasa Indonesia yang natural dan easy to understand. " +
                        "PENTING: Ketika menyebutkan sumber, gunakan format '[1]', '[2]', dll yang merujuk ke nomor sumber di hasil pencarian. " +
                        "Di akhir jawaban, tampilkan daftar sumber lengkap dengan URL dalam format yang rapi. " +
                        "Gunakan **bold** untuk penekanan pada informasi penting. " +
                        "JANGAN PERNAH gunakan format table atau grid. Selalu jawab dalam bentuk paragraf, list dengan bullet points, atau numbering saja.",
                },
                {
                    role: "user",
                    content: `Pertanyaan: ${question}\n\nHasil Web Search:\n${searchResults}\n\nJawab pertanyaan berdasarkan informasi di atas. Cite sumber dengan format [1], [2], dll. Di akhir jawaban, tampilkan daftar lengkap semua sumber dengan URL-nya.`,
                },
            ],
            model: "openai/gpt-oss-120b",
            temperature: 0.7,
            max_tokens: 2048,
        });

        const response =
            chatCompletion.choices[0]?.message?.content ||
            "Maaf, tidak ada respon.";

        // Convert markdown ke WhatsApp format
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

module.exports = { askGroq, askGroqWithSearch };
