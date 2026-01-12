const Groq = require("groq-sdk");

/**
 * Scoring-based heuristic router with mini LLM fallback
 * Uses weighted scoring to determine if web search is needed
 * Falls back to lightweight LLM for ambiguous cases
 */

// High priority: definitely needs search
const STRONG_SEARCH_INDICATORS = {
    keywords: [
        "latest",
        "news",
        "today",
        "yesterday",
        "current",
        "now",
        "recent",
        "this week",
        "this month",
        "trending",
        "viral",
        "breaking",
    ],
    weight: 4,
};

// Medium priority: likely needs search
const MODERATE_SEARCH_INDICATORS = {
    keywords: [
        "price",
        "stock",
        "harga",
        "weather",
        "cuaca",
        "forecast",
        "crypto",
        "bitcoin",
        "market",
        "event",
        "happening",
    ],
    weight: 2,
};

// Search intent keywords
const SEARCH_INTENT = {
    keywords: [
        "search",
        "find",
        "cari",
        "temukan",
        "where",
        "dimana",
        "locate",
    ],
    weight: 3,
};

// Year indicators (time-sensitive)
const YEAR_PATTERNS = {
    patterns: [/202[4-9]/, /203[0-9]/],
    weight: 3,
};

// Strong conversational indicators
const STRONG_CONVERSATIONAL = {
    keywords: [
        "thanks",
        "thank you",
        "terima kasih",
        "ok",
        "okay",
        "oke",
        "lanjutkan",
        "continue",
    ],
    weight: -4,
};

// Clarification/explanation requests
const CLARIFICATION = {
    keywords: [
        "explain",
        "jelaskan",
        "maksudnya",
        "mean",
        "artinya",
        "what do you mean",
        "can you explain",
        "bisa jelaskan",
        "more detail",
        "lebih detail",
    ],
    weight: -3,
};

// General knowledge indicators
const GENERAL_KNOWLEDGE = {
    keywords: [
        "who is",
        "siapa",
        "what is",
        "apa itu",
        "how to",
        "cara",
        "why",
        "mengapa",
        "kenapa",
        "history",
        "sejarah",
        "definition",
        "definisi",
        "meaning",
    ],
    weight: -2,
};

// Opinion/subjective questions
const SUBJECTIVE = {
    keywords: [
        "menurutmu",
        "in your opinion",
        "do you think",
        "bagaimana menurutmu",
        "what do you think",
        "should i",
        "haruskah",
    ],
    weight: -2,
};

/**
 * Calculate heuristic score for search necessity
 */
function calculateScore(question, isFollowUp, history) {
    const lowerQuestion = question.toLowerCase();
    let score = 0;
    const reasons = [];

    // Follow-up penalty
    if (isFollowUp && history.length > 0) {
        score -= 3;
        reasons.push("Follow-up conversation (-3)");
    }

    // Check strong search indicators
    if (
        STRONG_SEARCH_INDICATORS.keywords.some((k) => lowerQuestion.includes(k))
    ) {
        score += STRONG_SEARCH_INDICATORS.weight;
        reasons.push(
            `Time-sensitive keyword (+${STRONG_SEARCH_INDICATORS.weight})`,
        );
    }

    // Check moderate search indicators
    if (
        MODERATE_SEARCH_INDICATORS.keywords.some((k) =>
            lowerQuestion.includes(k),
        )
    ) {
        score += MODERATE_SEARCH_INDICATORS.weight;
        reasons.push(
            `Search indicator (+${MODERATE_SEARCH_INDICATORS.weight})`,
        );
    }

    // Check search intent
    if (SEARCH_INTENT.keywords.some((k) => lowerQuestion.includes(k))) {
        score += SEARCH_INTENT.weight;
        reasons.push(`Search intent (+${SEARCH_INTENT.weight})`);
    }

    // Check year patterns
    if (YEAR_PATTERNS.patterns.some((p) => p.test(lowerQuestion))) {
        score += YEAR_PATTERNS.weight;
        reasons.push(`Year mentioned (+${YEAR_PATTERNS.weight})`);
    }

    // Check strong conversational
    if (STRONG_CONVERSATIONAL.keywords.some((k) => lowerQuestion.includes(k))) {
        score += STRONG_CONVERSATIONAL.weight;
        reasons.push(`Conversational (${STRONG_CONVERSATIONAL.weight})`);
    }

    // Check clarification
    if (CLARIFICATION.keywords.some((k) => lowerQuestion.includes(k))) {
        score += CLARIFICATION.weight;
        reasons.push(`Clarification request (${CLARIFICATION.weight})`);
    }

    // Check general knowledge
    if (GENERAL_KNOWLEDGE.keywords.some((k) => lowerQuestion.includes(k))) {
        score += GENERAL_KNOWLEDGE.weight;
        reasons.push(`General knowledge (${GENERAL_KNOWLEDGE.weight})`);
    }

    // Check subjective
    if (SUBJECTIVE.keywords.some((k) => lowerQuestion.includes(k))) {
        score += SUBJECTIVE.weight;
        reasons.push(`Subjective question (${SUBJECTIVE.weight})`);
    }

    // Question length bonus (very short questions usually conversational)
    if (question.trim().split(/\s+/).length <= 3) {
        score -= 1;
        reasons.push("Short question (-1)");
    }

    return { score, reasons };
}

/**
 * Mini LLM fallback for ambiguous cases
 * Uses lightweight Groq model for quick decision
 */
async function askMiniLLM(question, history = []) {
    try {
        if (!process.env.GROQ_API_KEY) {
            console.log("Router: No Groq API key, defaulting to search");
            return true;
        }

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

        const messages = [
            {
                role: "system",
                content:
                    "You are a router that decides if a question needs real-time web search. " +
                    "Answer ONLY with: SEARCH or NO_SEARCH\n\n" +
                    "SEARCH if: time-sensitive, current events, specific data, prices, news\n" +
                    "NO_SEARCH if: conversational, general knowledge, opinion, clarification",
            },
            ...history.slice(-4).map((h) => ({
                role: h.role,
                content: h.content,
            })),
            {
                role: "user",
                content: `Question: "${question}"\n\nDecision:`,
            },
        ];

        const completion = await groq.chat.completions.create({
            messages: messages,
            model: "llama-3.3-70b-versatile",
            temperature: 0.1,
            max_tokens: 10,
        });

        const decision =
            completion.choices[0]?.message?.content?.trim().toUpperCase() || "";
        const needsSearch =
            decision.includes("SEARCH") && !decision.includes("NO_SEARCH");

        console.log(
            `Router: Mini LLM decided - ${needsSearch ? "SEARCH" : "NO_SEARCH"}`,
        );
        return needsSearch;
    } catch (error) {
        console.error(
            "Router: Mini LLM error, defaulting to search:",
            error.message,
        );
        return true;
    }
}

/**
 * Main router function with scoring + LLM fallback
 */
async function shouldSearch(question, isFollowUp = false, history = []) {
    const { score, reasons } = calculateScore(question, isFollowUp, history);

    console.log(`Router: Heuristic score = ${score}`);
    reasons.forEach((r) => console.log(`  - ${r}`));

    // Clear decision: definitely search
    if (score >= 4) {
        console.log("Router: HIGH score -> Web search required");
        return true;
    }

    // Clear decision: definitely no search
    if (score <= -3) {
        console.log("Router: LOW score -> No search needed");
        return false;
    }

    // Ambiguous case: use mini LLM
    console.log("Router: AMBIGUOUS score -> Consulting mini LLM...");
    return await askMiniLLM(question, history);
}

module.exports = {
    shouldSearch,
};
