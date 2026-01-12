const axios = require("axios");

let lastSearchSources = [];

/**
 * Search web using Tavily API
 * @param {string} query - Search query
 * @returns {Promise<string>} Search results with numbered references
 */
async function searchWeb(query) {
    try {
        const apiKey = process.env.TAVILY_API_KEY;

        if (!apiKey) {
            throw new Error("TAVILY_API_KEY not found in .env");
        }

        const response = await axios.post("https://api.tavily.com/search", {
            api_key: apiKey,
            query: query,
            search_depth: "basic",
            include_answer: true,
            max_results: 5,
        });

        // Format search results with numbered references
        const results = response.data;
        let formattedResults = "";

        // Reset and save sources
        lastSearchSources = [];

        if (results.answer) {
            formattedResults += `Summary: ${results.answer}\n\n`;
        }

        if (results.results && results.results.length > 0) {
            formattedResults += "Information Sources:\n\n";
            results.results.forEach((result, index) => {
                // Save for reference
                lastSearchSources.push({
                    title: result.title,
                    url: result.url,
                });

                // Format: [1] Title
                // Content
                // URL: https://...
                formattedResults += `[${index + 1}] ${result.title}\n`;
                formattedResults += `${result.content}\n`;
                formattedResults += `URL: ${result.url}\n\n`;
            });
        }

        return formattedResults || "No results found.";
    } catch (error) {
        console.error("Error searching web:", error);
        throw new Error("Failed to perform web search");
    }
}

function getLastSearchSources() {
    return lastSearchSources;
}

module.exports = { searchWeb, getLastSearchSources };
