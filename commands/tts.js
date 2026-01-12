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
        options: {},
    },
    idl: {
        voice: "id-ID-ArdiNeural",
        options: {},
    },
    enp: {
        voice: "en-US-AriaNeural",
        options: {},
    },
    enl: {
        voice: "en-US-GuyNeural",
        options: {},
    },
    jpp: {
        voice: "ja-JP-NanamiNeural",
        options: {
            pitch: -10,
            rate: -15,
        },
    },
    jpl: {
        voice: "ja-JP-KeitaNeural",
        options: {
            pitch: -10,
            rate: 0,
        },
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
                        "You are an expert in Japanese language. " +
                        "Task: Convert text into proper Japanese KATAKANA. " +
                        "If input is already in Japanese (Hiragana/Katakana/Kanji), keep it as is. " +
                        "If input is in other languages (Indonesian/English), convert phonetically to Katakana. " +
                        "ONLY output Katakana/Hiragana/Kanji, no other explanation.",
                },
                {
                    role: "user",
                    content: `Convert this text to proper Japanese Katakana: "${text}"`,
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
                        "🔊 *Text to Speech*\n\n" +
                        "How to use:\n" +
                        "!tts [voice] [text]\n\n" +
                        "Voice codes:\n" +
                        "• *idp* - Indonesian Female\n" +
                        "• *idl* - Indonesian Male\n" +
                        "• *enp* - English Female\n" +
                        "• *enl* - English Male\n" +
                        "• *jpp* - Japanese Female \n" +
                        "• *jpl* - Japanese Male \n\n" +
                        "Examples:\n" +
                        "• !tts idp Halo, apa kabar?\n" +
                        "• !tts enp Hello world!\n" +
                        "• !tts jpp Ohayou gozaimasu!\n" +
                        "• !tts jpl Ore wa Naruto da!\n\n" +
                        "*Note:* Japanese voice will auto-convert to Katakana",
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
                    text: "❌ Text cannot be empty!\n\nExample: !tts enp Hello world",
                });
                return;
            }

            // Convert to Katakana if Japanese voice
            if (isJapanese && process.env.GROQ_API_KEY) {
                console.log("Converting to Katakana...");
                try {
                    textToSpeak = await convertToKatakana(textToSpeak);
                } catch (err) {
                    console.error("Katakana conversion failed:", err);
                    // Continue with original text
                }
            }

            console.log(`Synthesizing with voice: ${voiceConfig.voice}`);
            console.log(`Text: "${textToSpeak}"`);
            console.log(`Options:`, voiceConfig.options);

            // Synthesize speech with options
            try {
                if (Object.keys(voiceConfig.options).length > 0) {
                    await tts.synthesize(
                        textToSpeak,
                        voiceConfig.voice,
                        voiceConfig.options,
                    );
                } else {
                    await tts.synthesize(textToSpeak, voiceConfig.voice);
                }
            } catch (synthError) {
                console.error("Synthesis error:", synthError);
                // Try without options as fallback
                console.log("Retrying without options...");
                await tts.synthesize(textToSpeak, voiceConfig.voice);
            }

            console.log("Synthesis completed successfully");

            // Create temp directory if not exists
            const tempDir = path.join(__dirname, "../temp");
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Save to temp file
            const timestamp = Date.now();
            const outputPath = path.join(tempDir, `tts_${timestamp}`);
            const filePath = await tts.toFile(outputPath);

            console.log(`Audio saved to: ${filePath}`);

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
            console.error("Error stack:", error.stack);
            await yunwa.sendMessage(sender, {
                text:
                    "❌ Error: " +
                    (error.message || "Failed to create voice") +
                    "\n\nPlease try again or use another voice.",
            });
        }
    },
};
