const { generateQuote } = require("../scrape/quote");

/**
 * Quote command - Generate a quote based on topic
 * Usage: !quote [topic]
 * Examples:
 *   !quote anime
 *   !quote motivasi
 *   !quote ahli
 *   !quote cinta
 *   !quote (random quote)
 */
module.exports = {
    name: "quote",
    description: "Generate a quote based on topic",
    category: "fun",

    async execute(yunwa, msg, sender, pushname, args = []) {
        try {
            await yunwa.sendPresenceUpdate("composing", sender);

            // Get topic from arguments
            const topic =
                args && args.length > 0 ? args.join(" ").trim() : null;

            const quote = await generateQuote(topic);

            const caption = `❝ ${quote.quote} ❞\n\n` + `— *${quote.author}*`;

            await yunwa.sendMessage(sender, {
                text: caption,
            });

            await yunwa.sendPresenceUpdate("paused", sender);
        } catch (error) {
            console.error("Error in quote command:", error);
            await yunwa.sendMessage(sender, {
                text: `❌ ${error.message || "Error occurred while generating quote"}\n\n💡 Usage: !quote [topic]\nExample: !quote anime`,
            });
        }
    },
};
