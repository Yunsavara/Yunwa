const chalk = require("chalk");
const commands = require("../commands");
const { isAskMessage } = require("../utils/conversation");

// Store processed message IDs to prevent duplicate processing
const processedMessages = new Set();
const MESSAGE_CACHE_SIZE = 1000;

// Cooldown tracking per user
const userCooldowns = new Map();
const COOLDOWN_TIME = 2000;

function cleanupMessageCache() {
    if (processedMessages.size > MESSAGE_CACHE_SIZE) {
        const idsToDelete = Array.from(processedMessages).slice(
            0,
            processedMessages.size - MESSAGE_CACHE_SIZE,
        );
        idsToDelete.forEach((id) => processedMessages.delete(id));
    }
}

function isOnCooldown(userId, commandName) {
    const key = `${userId}:${commandName}`;
    const cooldownEnd = userCooldowns.get(key);

    if (cooldownEnd && Date.now() < cooldownEnd) {
        return true;
    }

    return false;
}

function setCooldown(userId, commandName) {
    const key = `${userId}:${commandName}`;
    userCooldowns.set(key, Date.now() + COOLDOWN_TIME);

    setTimeout(() => {
        userCooldowns.delete(key);
    }, COOLDOWN_TIME);
}

function setupMessageHandler(yunwa) {
    yunwa.ev.on("messages.upsert", async (m) => {
        try {
            // Skip old messages
            if (m.type !== "notify") {
                return;
            }

            const msg = m.messages[0];

            if (!msg.message) return;
            if (msg.key.fromMe) return;

            // Anti-spam: Check if message already processed
            const messageId = msg.key.id;
            if (processedMessages.has(messageId)) {
                return;
            }

            const body =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                "";

            const sender = msg.key.remoteJid;
            const pushname = msg.pushName || "Yunwa";

            // Check if this is a reply to bot's message
            const contextInfo = msg.message.extendedTextMessage?.contextInfo;
            const quotedMsg = contextInfo?.quotedMessage;
            const participant = contextInfo?.participant;
            const quotedMsgId = contextInfo?.stanzaId;

            // Reply to bot if participant is not the sender
            const isReplyToBot =
                quotedMsg && !body.startsWith("!") && participant !== sender;

            // Check if quoted message is from ask command
            const isReplyToAskMessage =
                isReplyToBot && quotedMsgId && isAskMessage(quotedMsgId);

            // Handle follow-up conversation (only for ask command)
            if (isReplyToAskMessage) {
                processedMessages.add(messageId);
                cleanupMessageCache();

                if (isOnCooldown(sender, "ask")) {
                    return;
                }

                setCooldown(sender, "ask");

                const askCommand = commands["ask"];
                if (askCommand) {
                    try {
                        await askCommand.execute(yunwa, msg, sender, pushname);
                    } catch (error) {
                        console.error("Error in follow-up:", error);
                    }
                }
                return;
            }

            // Handle regular commands
            if (!body.startsWith("!")) return;

            const args = body.slice(1).trim().split(/ +/);
            const commandName = args[0].toLowerCase();

            if (isOnCooldown(sender, commandName)) {
                return;
            }

            processedMessages.add(messageId);
            cleanupMessageCache();
            setCooldown(sender, commandName);

            console.log(
                chalk.cyan(`Command received: ${commandName} from ${pushname}`),
            );

            const command = commands[commandName];

            if (command) {
                try {
                    await command.execute(yunwa, msg, sender, pushname);
                    console.log(
                        chalk.green(`Command '${commandName}' executed`),
                    );
                } catch (error) {
                    console.error(
                        chalk.red(`Error executing '${commandName}':`),
                        error,
                    );
                    await yunwa.sendMessage(sender, {
                        text: "Terjadi error saat menjalankan command!",
                    });
                }
            } else {
                console.log(chalk.yellow(`Command '${commandName}' not found`));
            }
        } catch (error) {
            console.error(chalk.red("Error handling message:"), error);
        }
    });
}

module.exports = { setupMessageHandler };
