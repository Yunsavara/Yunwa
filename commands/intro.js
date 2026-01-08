const fs = require("fs");
const path = require("path");

module.exports = {
    name: "intro",
    description: "Show bot introduction with image and available commands",

    async execute(yunwa, msg, sender, pushname) {
        try {
            const imagePath = path.join(__dirname, "../assets/intro.jpg");

            if (!fs.existsSync(imagePath)) {
                await yunwa.sendMessage(sender, {
                    text: `🤖 *Halo ${pushname}!*\n\nAku adalah *Yunwa*, asisten WhatsApp yang siap membantu kamu!\n\n📋 *Available Commands:*\n• !hello - Menyapa kamu\n• !ping - Test responsiveness bot\n• !intro - Perkenalan bot (pesan ini)\n\n_Note: Gambar intro belum tersedia. Silakan tambahkan file intro.jpg di folder assets/_`,
                });
            } else {
                const imageBuffer = fs.readFileSync(imagePath);

                const caption = `🤖 *Halo ${pushname}!*\n\nAku adalah *Yunwa*, asisten WhatsApp yang siap membantu kamu!\n\n📋 *Available Commands:*\n• !hello - Menyapa kamu\n• !ping - Test responsiveness bot\n• !intro - Perkenalan bot (pesan ini)\n\n✨ Ketik command dengan prefix ! untuk menggunakannya`;

                await yunwa.sendMessage(sender, {
                    image: imageBuffer,
                    caption: caption,
                });
            }
        } catch (error) {
            console.error("Error sending intro:", error);
            await yunwa.sendMessage(sender, {
                text: `❌ Maaf, terjadi error saat mengirim intro.\n\n🤖 *Yunwa Bot*\n\n📋 Commands: !hello, !ping, !intro`,
            });
        }
    },
};
