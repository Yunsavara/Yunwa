// modules
const {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
} = require("baileys");
const pino = require("pino");
const chalk = require("chalk");
const readline = require("readline");

// pairing method
// true => pairing code || false => scan qr
const usePairingCode = true;

// prompt input terminal
async function question(prompt) {
    const r1 = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) =>
        r1.question(prompt, (answer) => {
            r1.close();
            resolve(answer);
        }),
    );
}

// connection whatsapp
async function connectToWhatsapp() {
    console.log(chalk.yellow("Initiating connection to WhatsApp..."));

    // save the login session
    const { state, saveCreds } = await useMultiFileAuthState("./YunwaSession");

    // fetch latest version
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(
        chalk.blue(
            `Using WhatsApp v${version.join(".")}, isLatest: ${isLatest}`,
        ),
    );

    const yunwa = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: !usePairingCode,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"], // browser simulation
        version,
    });

    // pairing code method - request before connection opens
    if (usePairingCode && !yunwa.authState.creds.registered) {
        console.log(
            chalk.green(
                "\nInput phone number with country code (e.g., 6285163542861)",
            ),
        );
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

    // save login session
    yunwa.ev.on("creds.update", saveCreds);

    // event connection
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

    // Handle messages
    yunwa.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];

        if (!msg.message) return;

        const body =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            "";
        const sender = msg.key.remoteJid;
        const pushname = msg.pushName || "Yunwa";
    });
}

connectToWhatsapp();
