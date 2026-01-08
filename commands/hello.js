/**
 * Hello command
 * Responds with a greeting message
 */
module.exports = {
    name: "hello",
    description: "Greet the user",

    async execute(yunwa, msg, sender, pushname) {
        await yunwa.sendMessage(sender, {
            text: `Halo juga ${pushname}! 👋`,
        });
    },
};
