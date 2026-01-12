const { reconfigureMenu } = require("../utils/setup");
const chalk = require("chalk");

/**
 * Reconfig command - Reconfigure API keys or full reset
 * Usage: !reconfig (owner only)
 */
module.exports = {
    name: "reconfig",
    description: "Reconfigure API keys or full reset (console only)",
    category: "system",

    async execute(yunwa, msg, sender, pushname) {
        try {
            await yunwa.sendMessage(sender, {
                text:
                    "⚙️ *Reconfigure Mode*\n\n" +
                    "This command must be run from the console/terminal.\n\n" +
                    "To reconfigure:\n" +
                    "1. Stop the bot (Ctrl+C)\n" +
                    "2. Run: npm run reconfig\n" +
                    "3. Follow the prompts\n\n" +
                    "Or you can manually edit the .env file.",
            });
        } catch (error) {
            console.error("Error in reconfig command:", error);
            await yunwa.sendMessage(sender, {
                text: "❌ Error occurred while accessing reconfigure.",
            });
        }
    },
};
