/**
 * Hello command
 * Responds with a greeting message
 */
module.exports = {
    name: "hello",
    description: "Greet the user",
    category: "general",

    async execute(yunwa, msg, sender, pushname) {
        await yunwa.sendMessage(sender, {
            text: `Hello juga ${pushname}! 👋`,
        });
    },
};
