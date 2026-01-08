const fs = require("fs");
const path = require("path");

module.exports = {
    name: "intro",
    description: "Show bot introduction with image and available commands",

    async execute(yunwa, msg, sender, pushname) {
        try {
            // Auto-load semua commands dari folder commands/
            const commands = require("./index");

            // Build command list dari commands object
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

            commandList += `\n✨ Ketik command dengan prefix ! untuk menggunakannya`;

            const imagePath = path.join(__dirname, "../assets/intro.jpg");

            if (!fs.existsSync(imagePath)) {
                // Kirim text saja tanpa gambar
                await yunwa.sendMessage(sender, {
                    text: `*Halo ${pushname}!*\n\nAku adalah *Yunwa*, asisten WhatsApp yang siap membantu kamu!\n\n${commandList}`,
                });
            } else {
                // Kirim dengan gambar
                const imageBuffer = fs.readFileSync(imagePath);

                const caption = `*Halo ${pushname}!*\n\nAku adalah *Yunwa*, asisten WhatsApp yang siap membantu kamu!\n\n${commandList}`;

                await yunwa.sendMessage(sender, {
                    image: imageBuffer,
                    caption: caption,
                });
            }
        } catch (error) {
            console.error("Error sending intro:", error);
            await yunwa.sendMessage(sender, {
                text: `❌ Maaf, terjadi error saat mengirim intro.\n\n🤖 *Yunwa Bot*\n\nCoba lagi nanti ya!`,
            });
        }
    },
};
