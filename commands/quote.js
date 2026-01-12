const { generateQuote } = require("../scrape/quote");

/**
 * Quote command - Generate an inspirational quote using AI
 * Usage: !quote [topic]
 * Examples:
 *   !quote
 *   !quote love
 *   !quote friends
 *   !quote life
 */
module.exports = {
    name: "quote",
    description:
        "Generate an inspirational quote. Use !quote [topic] to specify a topic.",
    category: "fun",

    async execute(yunwa, msg, sender, pushname, args) {
        try {
            await yunwa.sendPresenceUpdate("composing", sender);

            // Get topic from arguments
            const topic = args.join(" ").trim() || null;

            // Show what topic is being used
            if (topic) {
                await yunwa.sendMessage(sender, {
                    text: `🔍 Generating quote about: *${topic}*...`,
                });
            }

            const quote = await generateQuote(topic);

            const caption =
                `✨ *Quote of the Day* ✨\n\n` +
                `_${quote.quote}_\n\n` +
                `— *${quote.author}*` +
                (quote.topic ? `\n\n📌 Topic: ${quote.topic}` : "");

            await yunwa.sendMessage(sender, {
                text: caption,
            });

            await yunwa.sendPresenceUpdate("paused", sender);
        } catch (error) {
            console.error("Error in quote command:", error);
            await yunwa.sendMessage(sender, {
                text: `❌ ${error.message || "Error occurred while generating quote"}\n\n💡 Usage: !quote [topic]\nExample: !quote motivasi`,
            });
        }
    },
};
