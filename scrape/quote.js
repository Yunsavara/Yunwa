const Groq = require("groq-sdk");

/**
 * Generate quote using Groq AI
 * @param {string} topic - Topic for the quote (e.g., "anime", "motivasi", "ahli", "cinta")
 * @returns {Promise<Object>} Quote object with text and author
 */
async function generateQuote(topic = "random") {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error("GROQ_API_KEY not configured! Run setup wizard.");
    }

    const groq = new Groq({ apiKey });

    const prompt = topic
        ? `Generate a unique and inspiring quote about "${topic}". The quote can be from a real person, fictional character, or original wisdom. Make it meaningful and match the topic. Respond in the same language as the topic.`
        : `Generate a unique and inspiring random quote. Can be from anyone or original wisdom. Make it meaningful.`;

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a quote generator. Generate unique, inspiring quotes based on the given topic. Format your response exactly as: the quote text, then a new line, then "— Author Name or Source". Be creative and make each quote unique. Never repeat the same quote. Do not use quotation marks around the quote.`,
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
