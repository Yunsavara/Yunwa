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

// Update and change indicators
const UPDATE_INDICATORS = {
    keywords: [
        "update",
        "updated",
        "new version",
        "versi baru",
        "terbaru",
        "perubahan",
        "changed",
        "release",
        "launch",
        "diluncurkan",
    ],
    weight: 4,
};

// Comparison keywords
const COMPARISON = {
    keywords: [
        "vs",
        "versus",
        "compare",
        "comparison",
        "bandingkan",
        "difference between",
        "perbedaan",
        "better than",
        "lebih baik",
    ],
    weight: 3,
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

// Statistics and data keywords
const STATISTICS = {
    keywords: [
        "how many",
        "berapa banyak",
        "statistics",
        "statistik",
        "data",
        "percentage",
        "persentase",
        "rate",
        "angka",
        "jumlah",
        "total",
    ],
    weight: 3,
};

// Verification intent
const VERIFICATION = {
    keywords: [
        "is it true",
        "benarkah",
        "verify",
        "fact check",
        "hoax",
        "real or fake",
        "benar atau salah",
        "confirm",
        "konfirmasi",
    ],
    weight: 3,
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
        "lokasi",
    ],
    weight: 3,
};

// Recent temporal indicators (high urgency)
const RECENT_TEMPORAL = {
    patterns: [
        /this (week|month|year)/i,
        /(minggu|bulan|tahun) ini/i,
        /hari ini/i,
        /sekarang/i,
        /saat ini/i,
    ],
    weight: 4,
};

// Historical temporal indicators (low urgency)
const HISTORICAL_TEMPORAL = {
    keywords: [
        "last year",
        "tahun lalu",
        "2020",
        "2021",
        "2022",
        "2023",
        "in the past",
        "dulu",
        "historically",
        "sejarah",
    ],
    weight: -1,
};

// Year indicators (current years)
const CURRENT_YEAR_PATTERNS = {
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
        "more",
        "lagi",
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
        "elaborate",
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
        "history of",
        "sejarah",
        "definition",
        "definisi",
        "meaning",
        "arti",
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
        "recommend",
        "rekomendasikan",
    ],
    weight: -2,
};

// Location-specific patterns
const LOCATION_PATTERNS = {
    patterns: [
        /in [A-Z][a-z]+/,
        /di [A-Z][a-z]+/,
        /\b(jakarta|surabaya|bandung|medan|semarang|bali)\b/i,
    ],
    weight: 2,
};

// URL/Domain detection
const URL_PATTERN = {
    pattern:
        /(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b/,
    weight: 2,
};

/**
 * Calculate heuristic score for search necessity
 */
function calculateScore(question, isFollowUp, history) {
    const lowerQuestion = question.toLowerCase();
    let score = 0;
    const reasons = [];

    if (isFollowUp && history.length > 0) {
        score -= 3;
        reasons.push("Follow-up conversation (-3)");
    }

    if (
        STRONG_SEARCH_INDICATORS.keywords.some((k) => lowerQuestion.includes(k))
    ) {
        score += STRONG_SEARCH_INDICATORS.weight;
        reasons.push(
            `Time-sensitive keyword (+${STRONG_SEARCH_INDICATORS.weight})`,
        );
    }

    if (UPDATE_INDICATORS.keywords.some((k) => lowerQuestion.includes(k))) {
        score += UPDATE_INDICATORS.weight;
        reasons.push(`Update indicator (+${UPDATE_INDICATORS.weight})`);
    }

    if (COMPARISON.keywords.some((k) => lowerQuestion.includes(k))) {
        score += COMPARISON.weight;
        reasons.push(`Comparison request (+${COMPARISON.weight})`);
    }

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

    if (STATISTICS.keywords.some((k) => lowerQuestion.includes(k))) {
        score += STATISTICS.weight;
        reasons.push(`Statistics query (+${STATISTICS.weight})`);
    }

    if (VERIFICATION.keywords.some((k) => lowerQuestion.includes(k))) {
        score += VERIFICATION.weight;
        reasons.push(`Verification request (+${VERIFICATION.weight})`);
    }

    if (SEARCH_INTENT.keywords.some((k) => lowerQuestion.includes(k))) {
        score += SEARCH_INTENT.weight;
        reasons.push(`Search intent (+${SEARCH_INTENT.weight})`);
    }

    if (RECENT_TEMPORAL.patterns.some((p) => p.test(question))) {
        score += RECENT_TEMPORAL.weight;
        reasons.push(`Recent temporal (+${RECENT_TEMPORAL.weight})`);
    }

    if (HISTORICAL_TEMPORAL.keywords.some((k) => lowerQuestion.includes(k))) {
        score += HISTORICAL_TEMPORAL.weight;
        reasons.push(`Historical reference (${HISTORICAL_TEMPORAL.weight})`);
    }

    if (CURRENT_YEAR_PATTERNS.patterns.some((p) => p.test(lowerQuestion))) {
        score += CURRENT_YEAR_PATTERNS.weight;
        reasons.push(
            `Current year mentioned (+${CURRENT_YEAR_PATTERNS.weight})`,
        );
    }

    if (LOCATION_PATTERNS.patterns.some((p) => p.test(question))) {
        score += LOCATION_PATTERNS.weight;
        reasons.push(`Location-specific (+${LOCATION_PATTERNS.weight})`);
    }

    if (URL_PATTERN.pattern.test(question)) {
        score += URL_PATTERN.weight;
        reasons.push(`URL detected (+${URL_PATTERN.weight})`);
    }

    if (STRONG_CONVERSATIONAL.keywords.some((k) => lowerQuestion.includes(k))) {
        score += STRONG_CONVERSATIONAL.weight;
        reasons.push(`Conversational (${STRONG_CONVERSATIONAL.weight})`);
    }

    if (CLARIFICATION.keywords.some((k) => lowerQuestion.includes(k))) {
        score += CLARIFICATION.weight;
        reasons.push(`Clarification request (${CLARIFICATION.weight})`);
    }

    if (GENERAL_KNOWLEDGE.keywords.some((k) => lowerQuestion.includes(k))) {
        score += GENERAL_KNOWLEDGE.weight;
        reasons.push(`General knowledge (${GENERAL_KNOWLEDGE.weight})`);
    }

    if (SUBJECTIVE.keywords.some((k) => lowerQuestion.includes(k))) {
        score += SUBJECTIVE.weight;
        reasons.push(`Subjective question (${SUBJECTIVE.weight})`);
    }

    const wordCount = question.trim().split(/\s+/).length;
    if (wordCount <= 3) {
        score -= 1;
        reasons.push("Short question (-1)");
    } else if (wordCount >= 15) {
        score += 1;
        reasons.push("Complex question (+1)");
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
            return true;
        }

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

        const messages = [
            {
                role: "system",
                content:
                    "You are a router that decides if a question needs real-time web search. " +
                    "Answer ONLY with: SEARCH or NO_SEARCH\n\n" +
                    "SEARCH if: time-sensitive, current events, specific data, prices, news, comparisons, verification\n" +
                    "NO_SEARCH if: conversational, general knowledge, opinion, clarification, explanation",
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

        return needsSearch;
    } catch (error) {
        return true;
    }
}

/**
 * Main router function with scoring + LLM fallback
 */
async function shouldSearch(question, isFollowUp = false, history = []) {
    const { score, reasons } = calculateScore(question, isFollowUp, history);

    if (score >= 4) {
        return true;
    }

    if (score <= -3) {
        return false;
    }

    return await askMiniLLM(question, history);
}

module.exports = {
    shouldSearch,
};
