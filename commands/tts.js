const { EdgeTTS } = require("@andresaya/edge-tts");
const fs = require("fs");
const path = require("path");
const { getGroqClient } = require("../scrape/groq");

/**
 * TTS Command - Text to Speech using Edge TTS
 * Usage: !tts [voice] [text]
 * Voice codes: idp, idl, enp, enl, jpp (anime waifu), jpl (anime husbando)
 */

// Hardcoded voice mappings with audio settings
const VOICE_MAP = {
    idp: {
        voice: "id-ID-GadisNeural",
        pitch: 0,
        rate: 0,
    },
    idl: {
        voice: "id-ID-ArdiNeural",
        pitch: 0,
        rate: 0,
    },
    enp: {
        voice: "en-US-AriaNeural",
        pitch: 0,
        rate: 0,
    },
    enl: {
        voice: "en-US-GuyNeural",
        pitch: 0,
        rate: 0,
    },
    jpp: {
        voice: "ja-JP-AoiNeural",
        pitch: "-15Hz",
        rate: "-20%",
    },
    jpl: {
        voice: "ja-JP-KeitaNeural",
        pitch: "-10Hz",
        rate: "0%",
    },
};

/**
 * Convert text to Japanese Katakana using Groq AI
 */
async function convertToKatakana(text) {
    try {
        const groq = getGroqClient();

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content:
                        "Kamu adalah expert dalam bahasa Jepang. " +
                        "Tugas: Konversi text ke dalam KATAKANA Jepang yang tepat. " +
                        "Jika input sudah dalam Jepang (Hiragana/Katakana/Kanji), biarkan saja. " +
                        "Jika input bahasa lain (Indonesia/English), konversi fonetiknya ke Katakana. " +
                        "HANYA output Katakana/Hiragana/Kanji, jangan ada penjelasan lain.",
                },
                {
                    role: "user",
                    content: `Konversi text ini ke Katakana Jepang yang tepat: "${text}"`,
                },
            ],
            model: "openai/gpt-oss-120b",
            temperature: 0.3,
            max_tokens: 200,
        });

        const katakana =
            chatCompletion.choices[0]?.message?.content?.trim() || text;
        console.log(`Text to Katakana: "${text}" → "${katakana}"`);
        return katakana;
    } catch (error) {
        console.error("Error converting to Katakana:", error);
        // Fallback: return original text
        return text;
    }
}

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
                        "• *enl* - English Male\n" +
                        "• *jpp* - Japanese Female (Anime Waifu)\n" +
                        "• *jpl* - Japanese Male (Anime Husbando) ⚔️\n\n" +
                        "Contoh:\n" +
                        "• !tts idp Halo, apa kabar?\n" +
                        "• !tts enp Hello world!\n" +
                        "• !tts jpp Ohayou gozaimasu!\n" +
                        "• !tts jpl Ore wa Naruto da!\n\n" +
                        "*Note:* Suara Jepang akan auto-convert ke Katakana",
                });
                return;
            }

            await yunwa.sendPresenceUpdate("recording", sender);

            const tts = new EdgeTTS();

            // Parse voice code and text
            const words = text.split(" ");
            const voiceCode = words[0].toLowerCase();

            let voiceConfig = VOICE_MAP.idp; // Default: Indonesian female
            let textToSpeak = text;
            let isJapanese = false;

            // Check if first word is a valid voice code
            if (VOICE_MAP[voiceCode]) {
                voiceConfig = VOICE_MAP[voiceCode];
                textToSpeak = words.slice(1).join(" ");
                isJapanese = voiceCode === "jpp" || voiceCode === "jpl";
            }

            // Validate text
            if (!textToSpeak.trim()) {
                await yunwa.sendMessage(sender, {
                    text: "❌ Text tidak boleh kosong!\n\nContoh: !tts idp Halo dunia",
                });
                return;
            }

            // Convert to Katakana if Japanese voice
            if (isJapanese && process.env.GROQ_API_KEY) {
                console.log("Converting to Katakana...");
                textToSpeak = await convertToKatakana(textToSpeak);
            }

            // Synthesize speech with options
            const synthesisOptions = {};
            if (voiceConfig.pitch) synthesisOptions.pitch = voiceConfig.pitch;
            if (voiceConfig.rate) synthesisOptions.rate = voiceConfig.rate;

            await tts.synthesize(
                textToSpeak,
                voiceConfig.voice,
                synthesisOptions,
            );

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
