const axios = require("axios");

/**
 * Search web menggunakan Tavily API
 * @param {string} query - Search query
 * @returns {Promise<string>} Search results
 */
async function searchWeb(query) {
    try {
        const apiKey = process.env.TAVILY_API_KEY;

        if (!apiKey) {
            throw new Error("TAVILY_API_KEY tidak ditemukan di .env");
        }

        const response = await axios.post("https://api.tavily.com/search", {
            api_key: apiKey,
            query: query,
            search_depth: "basic", // or "advanced" for more detailed
            include_answer: true,
            max_results: 5,
        });

        // Format hasil search
        const results = response.data;
        let formattedResults = "";

        if (results.answer) {
            formattedResults += `📌 Ringkasan: ${results.answer}\n\n`;
        }

        if (results.results && results.results.length > 0) {
            formattedResults += "🔍 Sumber:\n";
            results.results.forEach((result, index) => {
                formattedResults += `${index + 1}. ${result.title}\n${result.content}\nLink: ${result.url}\n\n`;
            });
        }

        return formattedResults || "Tidak ada hasil ditemukan.";
    } catch (error) {
        console.error("Error searching web:", error);
        throw new Error("Gagal melakukan pencarian web");
    }
}

module.exports = { searchWeb };
