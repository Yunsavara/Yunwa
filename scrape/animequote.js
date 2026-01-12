const axios = require("axios");

/**
 * Get random anime quote from Resita API
 * @returns {Promise<Object>} Random quote object
 */
async function getRandomAnimeQuote() {
    const apiKey = process.env.RESITA_API_KEY;
    if (!apiKey) {
        throw new Error("RESITA_API_KEY not configured! Run setup wizard.");
    }

    const url = "https://api.ferdev.my.id/random/animequote";
    const params = { apikey: apiKey };

    const response = await axios.get(url, { params });
    const data = response.data;

    if (
        !data.success ||
        !Array.isArray(data.result) ||
        data.result.length === 0
    ) {
        throw new Error("Failed to fetch anime quote.");
    }

    // Pick one quote randomly
    const randomIndex = Math.floor(Math.random() * data.result.length);
    return data.result[randomIndex];
}

module.exports = { getRandomAnimeQuote };
