const chalk = require("chalk");
const { DisconnectReason } = require("baileys");

/**
 * Handle WhatsApp connection events
 * @param {Object} yunwa - WhatsApp socket instance
 * @param {Function} connectToWhatsapp - Reconnection function
 */
function setupConnectionHandler(yunwa, connectToWhatsapp) {
    yunwa.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log(chalk.red("\nConnection closed"));
            console.log(chalk.yellow("Status Code:"), statusCode);
            console.log(chalk.yellow("Should Reconnect:"), shouldReconnect);

            if (statusCode === DisconnectReason.loggedOut) {
                console.log(
                    chalk.red(
                        "Device logged out. Please delete YunwaSession folder and restart.",
                    ),
                );
                process.exit(0);
            } else if (shouldReconnect) {
                console.log(chalk.yellow("Reconnecting in 5 seconds..."));
                setTimeout(() => connectToWhatsapp(), 5000);
            }
        } else if (connection === "open") {
            console.log(
                chalk.bgGreen.black(
                    "\n ✓ Successfully connected to WhatsApp! \n",
                ),
            );
        }
    });
}

module.exports = { setupConnectionHandler };
