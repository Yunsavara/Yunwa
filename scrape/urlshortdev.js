const axios = require("axios");

/**
 * Shorten URL using urlshort.dev API
 * @param {string} url - The URL to shorten
 * @returns {Promise<Object>} Object containing shortened URL
 */
async function shortenUrl(url) {
    try {
        // Validate URL format
        const urlPattern =
            /^(https?:\/\/)?([\w\-]+\.)+[\w\-]+(\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?$/i;
        if (!urlPattern.test(url)) {
            throw new Error("Invalid URL format");
        }

        // Add https:// if no protocol specified
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://" + url;
        }

        const response = await axios.post(
            "https://api.encurtador.dev/encurtamentos",
            { url: url },
            {
                headers: {
                    "Content-Type": "application/json",
                },
                timeout: 10000,
            },
        );

        return {
            originalUrl: url,
            shortUrl: response.data.urlEncurtada,
        };
    } catch (error) {
        if (error.response) {
            throw new Error(
                `API Error: ${error.response.status} - ${error.response.statusText}`,
            );
        }
        throw new Error(`Failed to shorten URL: ${error.message}`);
    }
}

module.exports = { shortenUrl };
