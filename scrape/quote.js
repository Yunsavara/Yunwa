const Groq = require("groq-sdk");

/**
 * Generate quote using Groq AI
 * @param {string} topic - Topic for the quote (e.g., "naruto", "motivasi", "ahli", "cinta")
 * @returns {Promise<Object>} Quote object with text and author
 */
async function generateQuote(topic = "random") {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error("GROQ_API_KEY not configured! Run setup wizard.");
    }

    const groq = new Groq({ apiKey });

    const prompt = topic
        ? `Generate a quote based on "${topic}". If it's a specific person or character name (like Naruto, Einstein, etc), give a direct quote FROM that person/character. If it's a general topic (like "motivasi", "cinta"), give a relevant inspirational quote. Make it unique and meaningful. Respond in the same language as the topic.`
        : `Generate a unique and inspiring random quote. Make it meaningful.`;

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a quote generator. When given a specific person or character name (e.g., "Naruto", "Einstein", "Luffy"), provide a famous quote DIRECTLY FROM that person/character - not just about them. When given a general topic, provide a relevant inspirational quote. Format: the quote text, then a new line, then "— Author/Character Name (Source if applicable)". Be creative and make each quote unique. Do not use quotation marks around the quote.`,
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.9,
            max_tokens: 300,
        });

        const response = chatCompletion.choices[0]?.message?.content || "";

        // Parse response to extract quote and author
        const lines = response
            .trim()
            .split("\n")
            .filter((line) => line.trim());
        let quoteText = "";
        let author = "Unknown";

        // Find author line (starts with —)
        const authorIndex = lines.findIndex((line) =>
            line.trim().startsWith("—"),
        );

        if (authorIndex !== -1) {
            author = lines[authorIndex].replace(/^—\s*/, "").trim();
            quoteText = lines.slice(0, authorIndex).join(" ").trim();
        } else {
            quoteText = lines.join(" ").trim();
        }

        return {
            quote: quoteText,
            author: author,
            topic: topic,
        };
    } catch (error) {
        throw new Error(`Failed to generate quote: ${error.message}`);
    }
}

module.exports = { generateQuote };
