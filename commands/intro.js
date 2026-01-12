const fs = require("fs");
const path = require("path");

module.exports = {
    name: "intro",
    description: "Show bot introduction with image and available commands",

    async execute(yunwa, msg, sender, pushname) {
        try {
            // Auto-load all commands from commands/ folder
            const commands = require("./index");

            // Build command list from commands object
            let commandList = "*Available Commands:*\n";

            // Array of command info
            const commandArray = Object.values(commands).map((cmd) => ({
                name: cmd.name,
                description: cmd.description || "No description",
            }));

            // Sort alphabetically
            commandArray.sort((a, b) => a.name.localeCompare(b.name));

            // Generate list
            commandArray.forEach((cmd) => {
                commandList += `• !${cmd.name} - ${cmd.description}\n`;
            });

            commandList += `\n✨ Type command with ! prefix to use it`;

            const imagePath = path.join(__dirname, "../assets/intro.jpg");

            if (!fs.existsSync(imagePath)) {
                // Send text only without image
                await yunwa.sendMessage(sender, {
                    text: `*Hello ${pushname}!*\n\nI'm *Yunwa*, a WhatsApp assistant ready to help you!\n\n${commandList}`,
                });
            } else {
                // Send with image
                const imageBuffer = fs.readFileSync(imagePath);

                const caption = `*Hello ${pushname}!*\n\nI'm *Yunwa*, a WhatsApp assistant ready to help you!\n\n${commandList}`;

                await yunwa.sendMessage(sender, {
                    image: imageBuffer,
                    caption: caption,
                });
            }
        } catch (error) {
            console.error("Error sending intro:", error);
            await yunwa.sendMessage(sender, {
                text: `❌ Sorry, an error occurred while sending intro.\n\n🤖 *Yunwa Bot*\n\nPlease try again later!`,
            });
        }
    },
};
