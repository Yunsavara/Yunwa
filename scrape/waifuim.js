const axios = require("axios");

/**
 * Get random waifu image from waifu.im API
 * @returns {Promise<Object>} Random waifu image data
 */
async function getRandomWaifu() {
    try {
        const response = await axios.get("https://api.waifu.im/search", {
            params: {
                included_tags: "waifu", // Only waifu tag
                is_nsfw: false, // SFW only
            },
        });

        const data = response.data;

        if (!data.images || data.images.length === 0) {
            throw new Error("No waifu found");
        }

        // Take first image (random from API)
        const image = data.images[0];

        return {
            url: image.url,
            artist: image.artist?.name || "Unknown Artist",
            artistTwitter: image.artist?.twitter || null,
            artistPixiv: image.artist?.pixiv || null,
            source: image.source || null,
            width: image.width,
            height: image.height,
            dominantColor: image.dominant_color,
        };
    } catch (error) {
        console.error("Error fetching waifu:", error);
        throw new Error("Failed to fetch waifu from API");
    }
}

module.exports = { getRandomWaifu };
