/**
 * Rule-based router to determine whether a question requires web search
 * Does NOT use AI for decision making – pure logic-based
 */

// Keywords indicating the need for real-time / web search
const SEARCH_INDICATORS = [
    // Time-sensitive
    "latest",
    "news",
    "today",
    "yesterday",
    "current",
    "now",
    "recent",
    "this week",
    "this month",
    "this year",
    "2024",
    "2025",

    // Weather & location
    "weather",
    "forecast",
    "temperature",
    "cuaca",

    // Financial & market
    "price",
    "stock",
    "harga",
    "crypto",
    "bitcoin",
    "market",

    // Events & trending
    "trending",
    "viral",
    "happening",
    "event",
    "sedang terjadi",

    // Search intent
    "cari",
    "search",
    "find",
    "temukan",
    "where",
    "dimana",
];

// Keywords indicating NO search is needed (conversational / follow-up)
const NO_SEARCH_INDICATORS = [
    // Conversational
    "thanks",
    "thank you",
    "terima kasih",
    "ok",
    "okay",
    "oke",
    "lanjutkan",
    "continue",
    "more",
    "lebih",
    "explain",
    "jelaskan",

    // Clarification
    "maksudnya",
    "mean",
    "artinya",
    "what do you mean",
    "can you explain",
    "bisa jelaskan",

    // Opinion / subjective
    "menurutmu",
    "in your opinion",
    "do you think",
    "bagaimana menurutmu",
];

// General knowledge topics that usually do not require real-time search
const GENERAL_KNOWLEDGE_TOPICS = [
    "who is",
    "siapa",
    "what is",
    "apa itu",
    "how to",
    "cara",
    "why",
    "mengapa",
    "kenapa",
    "when",
    "kapan",
    "history",
    "sejarah",
    "definition",
    "definisi",
];

/**
 * Determines whether a question requires web search
 * @param {string} question - User question
 * @param {boolean} isFollowUp - Whether this is a follow-up message
 * @param {Array} history - Conversation history
 * @returns {boolean} - true if web search is needed, false otherwise
 */
function shouldSearch(question, isFollowUp = false, history = []) {
    const lowerQuestion = question.toLowerCase();

    // Rule 1: Follow-up messages usually do not require search
    // unless a strong search indicator is present
    if (isFollowUp && history.length > 0) {
        const hasStrongSearchIndicator = SEARCH_INDICATORS.some((keyword) =>
            lowerQuestion.includes(keyword),
        );

        if (!hasStrongSearchIndicator) {
            console.log("Router: Follow-up conversation, no search needed");
            return false;
        }
    }

    // Rule 2: Conversational indicators
    const hasNoSearchIndicator = NO_SEARCH_INDICATORS.some((keyword) =>
        lowerQuestion.includes(keyword),
    );

    if (hasNoSearchIndicator) {
        console.log("Router: Conversational message, no search needed");
        return false;
    }

    // Rule 3: Search indicators (time-sensitive, market, events, etc.)
    const hasSearchIndicator = SEARCH_INDICATORS.some((keyword) =>
        lowerQuestion.includes(keyword),
    );

    if (hasSearchIndicator) {
        console.log("Router: Search indicator detected, web search required");
        return true;
    }

    // Rule 4: General knowledge questions usually do not require search
    const isGeneralKnowledge = GENERAL_KNOWLEDGE_TOPICS.some((topic) =>
        lowerQuestion.includes(topic),
    );

    if (isGeneralKnowledge) {
        console.log("Router: General knowledge question, no search needed");
        return false;
    }

    // Rule 5: Default behavior
    console.log("Router: New specific question, web search required");
    return true;
}

module.exports = {
    shouldSearch,
};
