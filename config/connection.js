const {
    makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
} = require("baileys");
const pino = require("pino");
const chalk = require("chalk");
const question = require("../utils/question");

// Pairing method: true = pairing code, false = QR scan
const usePairingCode = true;

/**
 * Create WhatsApp connection configuration
 */
async function createConnection() {
    console.log(chalk.yellow("Initiating connection to WhatsApp..."));

    // Save the login session
    const { state, saveCreds } = await useMultiFileAuthState("./YunwaSession");

    // Fetch latest version
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(
        chalk.blue(
            `Using WhatsApp v${version.join(".")}, isLatest: ${isLatest}`,
        ),
    );

    const yunwa = makeWASocket({
        logger: pino({ level: "fatal" }), // Changed from "silent" to "fatal" to suppress Baileys logs
        printQRInTerminal: !usePairingCode,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        version,
    });

    // Pairing code method
    if (usePairingCode && !yunwa.authState.creds.registered) {
        console.log(chalk.green("\nInput phone number with country code"));
        const phoneNumber = await question(chalk.cyan("> "));

        try {
            const code = await yunwa.requestPairingCode(phoneNumber.trim());
            console.log(chalk.bgGreen.black(`\n Pairing Code: ${code} `));
            console.log(
                chalk.yellow(
                    "Enter this code in WhatsApp: Settings > Linked Devices > Link a Device\n",
                ),
            );
        } catch (error) {
            console.log(
                chalk.red("Error requesting pairing code:"),
                error.message,
            );
            process.exit(1);
        }
    }

    // Save login session
    yunwa.ev.on("creds.update", saveCreds);

    return yunwa;
}

module.exports = { createConnection };
