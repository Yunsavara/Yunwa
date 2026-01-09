const axios = require("axios");

/**
 * Ghibli Image Generator - Generate Ghibli-style image from text prompt
 * Usage: !img <prompt>
 */
module.exports = {
    name: "img",
    description: "Generate a Ghibli-style image from your text prompt.",
    category: "media",

    async execute(yunwa, msg, sender, pushname) {
        try {
            const body =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                "";

            const prompt = body.slice(4).trim(); // Remove "!img"

            if (!prompt) {
                await yunwa.sendMessage(sender, {
                    text:
                        "❌ *Cara pakai:* !img <prompt>\n\n" +
                        "*Contoh:*\n" +
                        "• !img cowgirl\n" +
                        "• !img city at night\n",
                });
                return;
            }

            await yunwa.sendPresenceUpdate("composing", sender);

            const apiKey = process.env.RESITA_API_KEY;
            if (!apiKey) {
                throw new Error(
                    "RESITA_API_KEY belum di-setup! Jalankan setup wizard.",
                );
            }

            const url = `https://api.ferdev.my.id/tools/text2ghibli?prompt=${encodeURIComponent(prompt)}&apikey=${apiKey}`;

            // Fetch image (langsung image, bukan JSON)
            const imageResponse = await axios.get(url, {
                responseType: "arraybuffer",
            });
            const imageBuffer = Buffer.from(imageResponse.data, "binary");

            // Debug: log buffer size
            console.log("Image buffer size:", imageBuffer.length);

            if (!imageBuffer || imageBuffer.length === 0) {
                await yunwa.sendMessage(sender, {
                    text: "❌ Gagal generate gambar. Coba prompt lain atau ulangi beberapa saat lagi.",
                });
                await yunwa.sendPresenceUpdate("paused", sender);
                return;
            }

            await yunwa.sendMessage(sender, {
                image: imageBuffer,
                caption: `*Prompt:* ${prompt}\nSource: Ghibli Generator`,
            });

            await yunwa.sendPresenceUpdate("paused", sender);
        } catch (error) {
            console.error("Error in img command:", error);
            await yunwa.sendMessage(sender, {
                text: `❌ ${error.message || "Terjadi error saat generate gambar"}`,
            });
        }
    },
};
