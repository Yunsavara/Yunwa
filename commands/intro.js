const fs = require("fs");
const path = require("path");

module.exports = {
    name: "intro",
    description: "Show bot introduction",
    category: "general",

    async execute(yunwa, msg, sender, pushname) {
        try {
            // Auto-load all commands from commands/ folder
            const commands = require("./index");

            // Categorize commands
            const categories = {
                ai: { title: "🤖 AI & Smart Features", commands: [] },
                media: { title: "🎨 Media & Images", commands: [] },
                utility: { title: "🛠️ Utility Tools", commands: [] },
                fun: { title: "🎉 Fun & Entertainment", commands: [] },
                group: { title: "👥 Group Management", commands: [] },
                system: { title: "⚙️ System", commands: [] },
                general: { title: "📋 General", commands: [] },
            };

            // Group commands by category
            Object.values(commands).forEach((cmd) => {
                const category = cmd.category || "general";
                if (categories[category]) {
                    categories[category].commands.push({
                        name: cmd.name,
                        description: cmd.description || "No description",
                    });
                }
            });

            // Sort commands within each category alphabetically
            Object.values(categories).forEach((cat) => {
                cat.commands.sort((a, b) => a.name.localeCompare(b.name));
            });

            // Build command list
            let commandList = "*📚 Available Commands*\n\n";

            // Add commands by category
            Object.values(categories).forEach((category) => {
                // Skip empty categories
                if (category.commands.length === 0) return;

                commandList += `${category.title}\n`;
                category.commands.forEach((cmd) => {
                    commandList += `  • !${cmd.name} - ${cmd.description}\n`;
                });
                commandList += "\n";
            });

            commandList += `━━━━━━━━━━━━━━\n`;
            commandList += `✨ Type command with ! prefix`;

            const imagePath = path.join(__dirname, "../assets/intro.jpg");

            const caption = `*Hello ${pushname}!* 👋\n\nI'm *Yunwa*, your WhatsApp assistant created by *Yunsavara*.\n\n${commandList}`;

            if (!fs.existsSync(imagePath)) {
                // Send text only without image
                await yunwa.sendMessage(sender, {
                    text: caption,
                });
            } else {
                // Send with image
                const imageBuffer = fs.readFileSync(imagePath);

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
