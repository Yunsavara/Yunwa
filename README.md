# 🤖 Yunwa - WhatsApp Bot

Yunwa is a WhatsApp Bot built with Node.js and Baileys library. This bot is equipped with AI assistant, text-to-speech, sticker maker, and various other interesting features.

## ✨ Features

### 🧠 AI & Search
- **!ask** - AI assistant with real-time web search capability
  - Powered by Groq AI and Tavily Search API
  - Supports follow-up conversations with history
  - Smart routing between direct AI response and web search

### 🎨 Media
- **!sticker** - Convert images to WhatsApp stickers
  - Support text overlay (top & bottom text)
  - Auto-resize and crop with top bias for better framing
  - Format: `!sticker t:Top Text b:Bottom Text`

- **!tts** - Text to Speech with multiple voices
  - 6 voice options: Indonesian (male/female), English (male/female), Japanese (male/female)
  - Auto-convert to Katakana for Japanese voice
  - Format: `!tts [voice] [text]`

- **!waifu** - Random anime waifu image generator

### 📝 Utility
- **!lyrics** - Search song lyrics
- **!quote** - Generate random inspirational quotes
- **!slink** - Shorten URL with TinyURL
- **!pin** - Pinterest image search

### 👥 Group Management
- **!tagall** - Mention all group members (admin only)

### ℹ️ Info
- **!hello** - Greeting message
- **!intro** - Bot introduction
- **!ping** - Test bot responsiveness

## 📦 Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- ImageMagick (for stickers with text)
- libwebp (for WebP sticker conversion)

### Install Dependencies

```bash
# Clone repository
git clone https://github.com/Yunsavara/Yunwa.git
cd Yunwa

# Install packages
npm install

# Install system dependencies (Termux/Linux)
pkg install imagemagick libwebp  # Termux
# or
sudo apt install imagemagick webp  # Debian/Ubuntu
```

### Configuration

1. Copy `.env.example` to `.env` (if available)
2. Run setup wizard:

```bash
npm start
```

The bot will automatically run the setup wizard to configure required API keys:

- **Groq API Key** - For AI features (get it at [console.groq.com](https://console.groq.com/keys))
- **Tavily API Key** - For web search (get it at [tavily.com](https://tavily.com/))
- **Resita API Key** - For additional features (get it at [api.ferdev.my.id](https://api.ferdev.my.id/))

### Reconfigure

If you want to change configuration:

```bash
npm run reconfig
```

## 🚀 Running the Bot

```bash
npm start
```

On first run:
1. Bot will display a QR code
2. Scan the QR code with WhatsApp (Linked Devices)
3. Bot will connect and be ready to use

Session will be saved in `YunwaSession/` folder for automatic reconnection.

## 🛠️ Tech Stack

- **Baileys** - WhatsApp Web API
- **Groq SDK** - AI completions
- **Tavily** - Web search API
- **Edge TTS** - Text to speech
- **Jimp** - Image processing
- **node-webpmux** - WebP metadata
- **Axios** - HTTP client
- **Chalk** - Terminal styling

## 📝 License

ISC License

## 👨‍💻 Author

**Yunsavara**

## ⚠️ Disclaimer

This bot is created for educational and personal use purposes. Use it wisely and comply with WhatsApp's Terms of Service.

## 📞 Support

If you have any questions or issues:
1. Open an issue on GitHub
2. Check error logs in terminal
3. Make sure all dependencies are installed correctly 

---
