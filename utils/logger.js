const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Keywords to suppress
const suppressKeywords = [
    "Failed to decrypt message",
    "Session error",
    "Bad MAC",
    "Closing open session",
    "Closing session:",
    "SessionEntry",
    "_chains:",
    "registrationId:",
    "currentRatchet:",
    "ephemeralKeyPair:",
    "lastRemoteEphemeralKey:",
    "previousCounter:",
    "rootKey:",
    "indexInfo:",
    "baseKey:",
    "baseKeyType:",
    "remoteIdentityKey:",
];

// Check if log should be suppressed
function shouldSuppress(args) {
    const message = args.join(" ");
    return suppressKeywords.some((keyword) => message.includes(keyword));
}

// Override console.log
console.log = function (...args) {
    if (!shouldSuppress(args)) {
        originalConsoleLog.apply(console, args);
    }
};

// Override console.error
console.error = function (...args) {
    if (!shouldSuppress(args)) {
        originalConsoleError.apply(console, args);
    }
};

module.exports = {
    originalConsoleLog,
    originalConsoleError,
};
