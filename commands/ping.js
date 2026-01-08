/**
 * Ping command
 * Responds with "Pong!" to test bot responsiveness
 */
module.exports = {
    name: "ping",
    description: "Test bot responsiveness",

    async execute(yunwa, msg, sender, pushname) {
        await yunwa.sendMessage(sender, {
            text: "Pong! 🏓",
        });
    },
};
