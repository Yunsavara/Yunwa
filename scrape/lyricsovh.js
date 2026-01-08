const axios = require("axios");

/**
 * Get song lyrics from lyrics.ovh API
 * @param {string} artist - Artist name
 * @param {string} title - Song title
 * @returns {Promise<string>} Lyrics
 */
async function getLyrics(artist, title) {
    try {
        const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;

        console.log(`🎵 Fetching lyrics for: ${artist} - ${title}`);

        const response = await axios.get(url, {
            timeout: 10000, // 10 seconds timeout
        });

        if (response.data && response.data.lyrics) {
            return response.data.lyrics.trim();
        } else {
            throw new Error("Lyrics tidak ditemukan");
        }
    } catch (error) {
        console.error("Error fetching lyrics:", error.message);

        if (error.response && error.response.status === 404) {
            throw new Error(
                "Lagu tidak ditemukan. Pastikan artist dan judul lagu benar.",
            );
        } else if (error.code === "ECONNABORTED") {
            throw new Error("Request timeout. Coba lagi nanti.");
        } else {
            throw new Error("Gagal mendapatkan lyrics. Coba lagi nanti.");
        }
    }
}

module.exports = { getLyrics };
