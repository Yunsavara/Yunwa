const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleDebug = console.debug;

// Keywords to suppress
const suppressKeywords = [
    "Failed to decrypt message",
    "Session error",
    "Bad MAC",
    "Closing open session",
    "Closing session",
    "SessionEntry",
    "_chains",
    "registrationId",
    "currentRatchet",
    "ephemeralKeyPair",
    "lastRemoteEphemeralKey",
    "previousCounter",
    "rootKey",
    "indexInfo",
    "baseKey",
    "baseKeyType",
    "remoteIdentityKey",
    "pendingPreKey",
    "signedKeyId",
    "preKeyId",
];

// Check if log should be suppressed
function shouldSuppress(args) {
    // Convert all arguments to string, including objects
    const message = args
        .map((arg) => {
            if (typeof arg === "object") {
                return JSON.stringify(arg);
            }
            return String(arg);
        })
        .join(" ");

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

// Override console.warn
console.warn = function (...args) {
    if (!shouldSuppress(args)) {
        originalConsoleWarn.apply(console, args);
    }
};

// Override console.debug
console.debug = function (...args) {
    if (!shouldSuppress(args)) {
        originalConsoleDebug.apply(console, args);
    }
};

module.exports = {
    originalConsoleLog,
    originalConsoleError,
    originalConsoleWarn,
    originalConsoleDebug,
};
