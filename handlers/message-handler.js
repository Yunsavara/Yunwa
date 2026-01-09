const chalk = require("chalk");
const commands = require("../commands");

// Store processed message IDs to prevent duplicate processing
const processedMessages = new Set();
const MESSAGE_CACHE_SIZE = 1000;

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

            // 🔍 DEBUG: Log message structure untuk lihat reply info
            if (msg.message.extendedTextMessage?.contextInfo) {
                console.log(chalk.gray("=== DEBUG REPLY INFO ==="));
                console.log(
                    chalk.gray(
                        "Has quotedMessage:",
                        !!msg.message.extendedTextMessage?.contextInfo
                            ?.quotedMessage,
                    ),
                );
                console.log(
                    chalk.gray(
                        "Participant:",
                        msg.message.extendedTextMessage?.contextInfo
                            ?.participant,
                    ),
                );
                console.log(
                    chalk.gray(
                        "fromMe in quoted:",
                        msg.message.extendedTextMessage?.contextInfo
                            ?.quotedMessage
                            ? "exists"
                            : "none",
                    ),
                );
                console.log(chalk.gray("Body:", body));
                console.log(chalk.gray("========================"));
            }

            // ✅ CHECK: Is this a reply to bot's message? (for follow-up)
            const contextInfo = msg.message.extendedTextMessage?.contextInfo;
            const quotedMsg = contextInfo?.quotedMessage;

            // Check if reply to bot: participant should be undefined (in private chat) or match bot number
            const isReplyToBot = quotedMsg && !contextInfo?.participant;

            // If reply to bot, treat as !ask follow-up
            if (isReplyToBot && body && !body.startsWith("!")) {
                console.log(
                    chalk.magenta(
                        `[FOLLOW-UP] Detected reply from ${pushname}: "${body}"`,
                    ),
                );

                // Mark as processed
                processedMessages.add(messageId);
                cleanupMessageCache();

                // Check cooldown for ask command
                if (isOnCooldown(sender, "ask")) {
                    console.log(
                        chalk.yellow(
                            `[COOLDOWN] ${pushname} is on cooldown for 'ask'`,
                        ),
                    );
                    return;
                }

                // Set cooldown
                setCooldown(sender, "ask");

                // Execute ask command with reply context
                const askCommand = commands["ask"];
                if (askCommand) {
                    try {
                        await askCommand.execute(yunwa, msg, sender, pushname);
                        console.log(
                            chalk.green(`✓ Follow-up conversation processed`),
                        );
                    } catch (error) {
                        console.error(
                            chalk.red(`✗ Error in follow-up conversation:`),
                            error,
                        );
                        await yunwa.sendMessage(sender, {
                            text: "❌ Terjadi error saat follow-up!",
                        });
                    }
                }
                return;
            }

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
