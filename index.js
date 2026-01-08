// modules
const { makeWASocket, useMultiFileAuthState } = require("baileys");
const pino = require("pino");
const chalk = require("chalk");
const readline = require("readline");

// pairing method
// true => pairing code || false => scan qr
const usePairingCode = true;

// prompt input terminal
async function question(prompt) {
    process.stdout.write(prompt);
    const r1 = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) =>
        r1.question("", (answer) => {
            r1.close();
            resolve(answer);
        }),
    );
}

// connection whatsapp
async function connectToWhatsapp() {
    console.log("initiate connection to whatsapp");

    // save the login session
    const { state, saveCreds } = await useMultiFileAuthState("./YunwaSession");

    const yunwa = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: !usePairingCode,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"], // browser simulation
        version: [2, 3000, 1015901307], // whatsapp version
    });

    // pairing code method
    if (usePairingCode && !yunwa.authState.creds.registered) {
        console.log(chalk.green("Input numbers that prefix is 62"));
        const phoneNumber = await question("> ");
        const code = await yunwa.requestPairingCode(phoneNumber.trim());
        console.log(chalk.cyan(`Pairing code ${code}`));
    }

    // save login session
    yunwa.ev.on("creds.update", saveCreds);

    // event connection
    yunwa.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            console.log(chalk.red("Connection is closed, trying to reconnect"));
            connectToWhatsapp();
        } else if (connection === "open") {
            console.log(chalk.red("Bot is connected to whatsapp"));
        }
    });
}

connectToWhatsapp();
