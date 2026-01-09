const { EdgeTTS } = require("@andresaya/edge-tts");
const fs = require("fs");
const path = require("path");

/**
 * TTS Command - Text to Speech using Edge TTS
 * Usage: !tts [text] or !tts [voice] [text]
 */
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
                        "🔊 *Text to Speech*\n\n" +
                        "Cara pakai:\n" +
                        "• !tts [text]\n" +
                        "• !tts [voice] [text]\n\n" +
                        "Contoh:\n" +
                        "• !tts Halo, apa kabar?\n" +
                        "• !tts id-ID-ArdiNeural Selamat pagi!\n" +
                        "• !tts en-US-AriaNeural Hello world!\n\n" +
                        "Voice default: id-ID-GadisNeural\n\n" +
                        "Kirim *!tts voices* untuk list voice",
                });
                return;
            }

            // Handle voice list request
            if (text.toLowerCase() === "voices") {
                await yunwa.sendPresenceUpdate("composing", sender);

                const tts = new EdgeTTS();
                const voices = await tts.getVoices();

                // Filter Indonesian voices
                const idVoices = voices.filter((v) =>
                    v.Locale.startsWith("id-"),
                );

                let voiceList = "🎤 *Voice List*\n\n";
                voiceList += "*Indonesian Voices:*\n";
                idVoices.forEach((v) => {
                    voiceList += `• ${v.ShortName} (${v.Gender})\n`;
                });

                voiceList += "\n*Popular English Voices:*\n";
                const popularEN = [
                    "en-US-AriaNeural",
                    "en-US-GuyNeural",
                    "en-US-JennyNeural",
                    "en-GB-SoniaNeural",
                    "en-GB-RyanNeural",
                ];

                popularEN.forEach((name) => {
                    const voice = voices.find((v) => v.ShortName === name);
                    if (voice) {
                        voiceList += `• ${voice.ShortName} (${voice.Gender})\n`;
                    }
                });

                voiceList += "\nTotal voices: " + voices.length;

                await yunwa.sendMessage(sender, { text: voiceList });
                return;
            }

            await yunwa.sendPresenceUpdate("recording", sender);

            const tts = new EdgeTTS();

            // Parse voice and text
            let voice = "id-ID-GadisNeural"; // Default Indonesian female voice
            let textToSpeak = text;

            // Check if first word is a voice name
            const words = text.split(" ");
            if (words[0].includes("-") && words[0].includes("Neural")) {
                voice = words[0];
                textToSpeak = words.slice(1).join(" ");
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
