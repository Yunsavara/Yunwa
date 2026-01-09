const axios = require("axios");

/**
 * Search Pinterest images using Resita API and return a random result
 * @param {string} query
 * @returns {Promise<string>} Image URL
 */
async function searchPinterest(query) {
    const apiKey = process.env.RESITA_API_KEY;
    if (!apiKey) {
        throw new Error(
            "RESITA_API_KEY belum di-setup! Jalankan setup wizard.",
        );
    }

    const url = "https://api.ferdev.my.id/search/pinterest";
    const params = {
        query,
        apikey: apiKey,
    };

    const response = await axios.get(url, { params });
    const data = response.data;

    if (
        !data.succes ||
        !Array.isArray(data.result) ||
        data.result.length === 0
    ) {
        throw new Error(
            "Gagal menemukan gambar Pinterest untuk query tersebut.",
        );
    }

    // Pick random image
    const randomIndex = Math.floor(Math.random() * data.result.length);
    return data.result[randomIndex];
}

module.exports = { searchPinterest };
