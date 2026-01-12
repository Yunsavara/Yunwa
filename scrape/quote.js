const Groq = require("groq-sdk");

/**
 * Generate motivational quote using Groq AI
 * @param {string} topic - Topic for the quote (optional)
 * @returns {Promise<Object>} Quote object with text and author
 */
async function generateQuote(topic = null) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error("GROQ_API_KEY not configured! Run setup wizard.");
    }

    const groq = new Groq({ apiKey });

    const prompt = topic
        ? `Give me a real, famous quote about "${topic}". The quote must be from a well-known person (philosopher, scientist, author, leader, etc). Do not invent quotes or authors. Respond in the same language as the topic provided. Format: the quote text (without quotation marks), then on a new line: — Author Name`
        : `Give me a real, famous inspirational quote. The quote must be from a well-known person (philosopher, scientist, author, leader, etc). Do not invent quotes or authors. Format: the quote text (without quotation marks), then on a new line: — Author Name`;

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a wise assistant who only provides real, famous quotes from well-known people (philosophers, scientists, authors, leaders, etc). Never invent quotes or authors. When given a topic, detect the language of the topic and respond in that same language. If no topic is given, use English. Format your response exactly as: the quote text, then a new line, then "— Author Name". Do not use quotation marks around the quote.`,
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.8,
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
