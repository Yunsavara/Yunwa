// Store conversation history per user
// Structure: { userId: [{ role: "user", content: "..." }, ...] }
const conversationHistory = new Map();

// Max messages to keep in history (untuk prevent memory bloat)
const MAX_HISTORY_LENGTH = 10; // 5 user + 5 assistant messages

// Auto-clear history after idle time (30 minutes)
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const idleTimers = new Map();

/**
 * Get conversation history for a user
 */
function getHistory(userId) {
    return conversationHistory.get(userId) || [];
}

/**
 * Add message to conversation history
 */
function addToHistory(userId, role, content) {
    let history = conversationHistory.get(userId) || [];

    // Add new message
    history.push({ role, content });

    // Keep only last MAX_HISTORY_LENGTH messages
    if (history.length > MAX_HISTORY_LENGTH) {
        history = history.slice(-MAX_HISTORY_LENGTH);
    }

    conversationHistory.set(userId, history);

    // Reset idle timer
    resetIdleTimer(userId);
}

/**
 * Clear conversation history for a user
 */
function clearHistory(userId) {
    conversationHistory.delete(userId);
    clearIdleTimer(userId);
}

/**
 * Reset idle timer for auto-clear
 */
function resetIdleTimer(userId) {
    // Clear existing timer
    if (idleTimers.has(userId)) {
        clearTimeout(idleTimers.get(userId));
    }

    // Set new timer
    const timer = setTimeout(() => {
        clearHistory(userId);
        console.log(`[CONVERSATION] Auto-cleared history for ${userId} (idle)`);
    }, IDLE_TIMEOUT);

    idleTimers.set(userId, timer);
}

/**
 * Clear idle timer
 */
function clearIdleTimer(userId) {
    if (idleTimers.has(userId)) {
        clearTimeout(idleTimers.get(userId));
        idleTimers.delete(userId);
    }
}

module.exports = {
    getHistory,
    addToHistory,
    clearHistory,
};
