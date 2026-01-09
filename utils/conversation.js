// Store conversation history per user
const conversationHistory = new Map();

// Track which messages are from ask command (for follow-up detection)
const askMessageIds = new Set();

// Max messages to keep in history
const MAX_HISTORY_LENGTH = 10;

// Auto-clear history after idle time (30 minutes)
const IDLE_TIMEOUT = 30 * 60 * 1000;
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

    history.push({ role, content });

    // Keep only last MAX_HISTORY_LENGTH messages
    if (history.length > MAX_HISTORY_LENGTH) {
        history = history.slice(-MAX_HISTORY_LENGTH);
    }

    conversationHistory.set(userId, history);

    resetIdleTimer(userId);
}

/**
 * Register message ID as ask command response (for follow-up detection)
 */
function registerAskMessage(messageId) {
    askMessageIds.add(messageId);

    // Auto-cleanup after 30 minutes
    setTimeout(() => {
        askMessageIds.delete(messageId);
    }, IDLE_TIMEOUT);
}

/**
 * Check if message ID is from ask command
 */
function isAskMessage(messageId) {
    return askMessageIds.has(messageId);
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
    if (idleTimers.has(userId)) {
        clearTimeout(idleTimers.get(userId));
    }

    const timer = setTimeout(() => {
        clearHistory(userId);
        console.log(
            `Conversation history cleared for ${userId} (idle timeout)`,
        );
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
    registerAskMessage,
    isAskMessage,
};
