const chalk = require("chalk");
const commands = require("../commands");

/**
 * Handle incoming WhatsApp messages
 * @param {Object} yunwa - WhatsApp socket instance
 */
function setupMessageHandler(yunwa) {
    yunwa.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];

            if (!msg.message) return;

            // Ignore pesan dari bot sendiri
            if (msg.key.fromMe) return;

            const body =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                "";

            const sender = msg.key.remoteJid;
            const pushname = msg.pushName || "Yunwa";

            // prefix bot Yunwa
            if (!body.startsWith("!")) return;

            // commands execution
            const commandName = body.slice(1).trim().toLowerCase();

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
