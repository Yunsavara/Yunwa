const { EdgeTTS } = require("@andresaya/edge-tts");
const fs = require("fs");
const path = require("path");

/**
 * TTS Command - Text to Speech using Edge TTS
 * Usage: !tts [voice] [text]
 * Voice codes: idp, idl, enp, enl
 */

// Hardcoded voice mappings
const VOICE_MAP = {
    idp: "id-ID-GadisNeural",
    idl: "id-ID-ArdiNeural",
    enp: "en-US-AriaNeural",
    enl: "en-US-GuyNeural",
};

module.exports = {
    name: "tts",
    description: "Convert text to speech (Edge TTS)",
    category: "utility",

    async execute(yunwa, msg, sender, pushname) {
        try {
            const body =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                "";

            let text = body.slice(4).trim();

            if (!text) {
                await yunwa.sendMessage(sender, {
                    text:
                        "*Text to Speech*\n\n" +
                        "Cara pakai:\n" +
                        "!tts [voice] [text]\n\n" +
                        "Voice codes:\n" +
                        "• *idp* - Indonesia Perempuan\n" +
                        "• *idl* - Indonesia Laki-laki\n" +
                        "• *enp* - English Female\n" +
                        "• *enl* - English Male\n\n" +
                        "Contoh:\n" +
                        "• !tts idp Halo, apa kabar?\n" +
                        "• !tts idl Selamat pagi!\n" +
                        "• !tts enp Hello world!\n" +
                        "• !tts enl Good morning!",
                });
                return;
            }

            await yunwa.sendPresenceUpdate("recording", sender);

            const tts = new EdgeTTS();

            // Parse voice code and text
            const words = text.split(" ");
            const voiceCode = words[0].toLowerCase();

            let voice = VOICE_MAP.idp; // Default: Indonesian female
            let textToSpeak = text;

            // Check if first word is a valid voice code
            if (VOICE_MAP[voiceCode]) {
                voice = VOICE_MAP[voiceCode];
                textToSpeak = words.slice(1).join(" ");
            }

            // Validate text
            if (!textToSpeak.trim()) {
                await yunwa.sendMessage(sender, {
                    text: "❌ Text tidak boleh kosong!\n\nContoh: !tts idp Halo dunia",
                });
                return;
            }

            // Synthesize speech
            await tts.synthesize(textToSpeak, voice);

            // Create temp directory if not exists
            const tempDir = path.join(__dirname, "../temp");
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Save to temp file
            const timestamp = Date.now();
            const outputPath = path.join(tempDir, `tts_${timestamp}`);
            const filePath = await tts.toFile(outputPath);

            // Send audio
            await yunwa.sendMessage(sender, {
                audio: fs.readFileSync(filePath),
                mimetype: "audio/mp4",
                ptt: true, // Send as voice note
            });

            // Cleanup temp file
            fs.unlinkSync(filePath);

            await yunwa.sendPresenceUpdate("paused", sender);
        } catch (error) {
            console.error("Error in tts command:", error);
            await yunwa.sendMessage(sender, {
                text: "❌ Error: " + (error.message || "Gagal membuat voice"),
            });
        }
    },
};
