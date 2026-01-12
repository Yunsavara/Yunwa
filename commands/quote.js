const { getRandomAnimeQuote } = require("../scrape/animequote");

/**
 * Anime Quote command - Get a random anime quote
 * Usage: !quote
 */
module.exports = {
    name: "quote",
    description: "Get a random quote from an anime character.",
    category: "fun",

    async execute(yunwa, msg, sender, pushname) {
        try {
            await yunwa.sendPresenceUpdate("composing", sender);

            const quote = await getRandomAnimeQuote();

            const caption =
                `_"${quote.quote}"_\n\n` +
                `*${quote.char}* — ${quote.from_anime}\n` +
                `${quote.episode ? `📺 ${quote.episode}` : ""}`;

            await yunwa.sendMessage(sender, {
                text: caption,
            });

            await yunwa.sendPresenceUpdate("paused", sender);
        } catch (error) {
            console.error("Error in quote command:", error);
            await yunwa.sendMessage(sender, {
                text: `❌ ${error.message || "Error occurred while fetching anime quote"}`,
            });
        }
    },
};
