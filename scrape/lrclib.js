const axios = require("axios");

/**
 * Search lyrics from LRCLIB API
 * @param {string} query - Search query (song name, artist, etc)
 * @returns {Promise<Object>} First search result with lyrics
 */
async function searchLyrics(query) {
    try {
        const response = await axios.get("https://lrclib.net/api/search", {
            params: {
                q: query,
            },
        });

        const results = response.data;

        if (!results || results.length === 0) {
            throw new Error("Lyrics not found");
        }

        // Take first result
        const firstResult = results[0];

        return {
            id: firstResult.id,
            trackName: firstResult.trackName || firstResult.name,
            artistName: firstResult.artistName,
            albumName: firstResult.albumName,
            duration: firstResult.duration,
            plainLyrics: firstResult.plainLyrics,
            syncedLyrics: firstResult.syncedLyrics,
        };
    } catch (error) {
        if (error.message === "Lyrics not found") {
            throw error;
        }
        console.error("Error searching lyrics:", error);
        throw new Error("Failed to search lyrics from LRCLIB");
    }
}

module.exports = { searchLyrics };
