const chalk = require("chalk");
const commands = require("../commands");

// Store processed message IDs to prevent duplicate processing
const processedMessages = new Set();
const MESSAGE_CACHE_SIZE = 1000; // Keep last 1000 message IDs

// Cooldown tracking per user
const userCooldowns = new Map();
const COOLDOWN_TIME = 2000; // 2 seconds cooldown per command

/**
 * Clean up old message IDs to prevent memory leak
 */
function cleanupMessageCache() {
    if (processedMessages.size > MESSAGE_CACHE_SIZE) {
        const idsToDelete = Array.from(processedMessages).slice(
            0,
            processedMessages.size - MESSAGE_CACHE_SIZE,
        );
        idsToDelete.forEach((id) => processedMessages.delete(id));
    }
}

/**
 * Check if user is on cooldown
 */
function isOnCooldown(userId, commandName) {
    const key = `${userId}:${commandName}`;
    const cooldownEnd = userCooldowns.get(key);

    if (cooldownEnd && Date.now() < cooldownEnd) {
        return true;
    }

    return false;
}

/**
 * Set cooldown for user
 */
function setCooldown(userId, commandName) {
    const key = `${userId}:${commandName}`;
    userCooldowns.set(key, Date.now() + COOLDOWN_TIME);

    // Clean up expired cooldowns
    setTimeout(() => {
        userCooldowns.delete(key);
    }, COOLDOWN_TIME);
}

/**
 * Handle incoming WhatsApp messages
 * @param {Object} yunwa - WhatsApp socket instance
 */
function setupMessageHandler(yunwa) {
    yunwa.ev.on("messages.upsert", async (m) => {
        try {
            // skip old message when activate bot (avoided spam)
            if (m.type !== "notify") {
                console.log(chalk.gray(`[SKIP] Message type: ${m.type}`));
                return;
            }

            const msg = m.messages[0];

            if (!msg.message) return;

            // Ignore pesan dari bot sendiri
            if (msg.key.fromMe) return;

            // ANTI-SPAM: Check if message already processed (deduplication)
            const messageId = msg.key.id;
            if (processedMessages.has(messageId)) {
                console.log(
                    chalk.gray(`[SKIP] Duplicate message: ${messageId}`),
                );
                return;
            }

            const body =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                "";

            const sender = msg.key.remoteJid;
            const pushname = msg.pushName || "Yunwa";

            // prefix bot Yunwa
            if (!body.startsWith("!")) return;

            // Split command dan ambil kata pertama saja sebagai command name
            const args = body.slice(1).trim().split(/ +/);
            const commandName = args[0].toLowerCase();

            // ANTI-SPAM: Check cooldown
            if (isOnCooldown(sender, commandName)) {
                console.log(
                    chalk.yellow(
                        `[COOLDOWN] ${pushname} is on cooldown for '${commandName}'`,
                    ),
                );
                return;
            }

            // Mark message as processed
            processedMessages.add(messageId);
            cleanupMessageCache();

            // Set cooldown
            setCooldown(sender, commandName);

            // log inputed message (cuma yang pakai prefix !)
            console.log(
                chalk.cyan(
                    `✓ Perintah diterima: ${commandName} dari ${pushname}`,
                ),
            );

            // Execute command
            const command = commands[commandName];

            if (command) {
                try {
                    await command.execute(yunwa, msg, sender, pushname);
                    console.log(
                        chalk.green(`✓ Command '${commandName}' executed`),
                    );
                } catch (error) {
                    console.error(
                        chalk.red(
                            `✗ Error executing command '${commandName}':`,
                        ),
                        error,
                    );
                    await yunwa.sendMessage(sender, {
                        text: "❌ Terjadi error saat menjalankan command!",
                    });
                }
            } else {
                console.log(
                    chalk.yellow(`⚠ Command '${commandName}' tidak dikenali`),
                );
            }
        } catch (error) {
            console.error(chalk.red("Error handling message:"), error);
        }
    });
}

module.exports = { setupMessageHandler };
