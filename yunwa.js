module.exports = async (yunwa, m) => {
    const msg = m.messages[0];

    if (!msg.message) return;

    const body =
        msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const sender = msg.key.remoteJid;
    const pushname = msg.pushName || "Yunwa";

    // prefix bot Yunwa
    if (!body.startsWith("!")) return;

    // commands execution
    const command = body.slice(1).trim().toLowerCase();

    // log inputed message
    console.log(`Perintah diterima: ${command}`);

    // features
    switch (command) {
        case "halo":
            await yunwa.sendMessage(sender, { text: "Halo juga beb!" });
            break;
        case "ping":
            await yunwa.sendMessage(sender, { text: "Pong!" });
            break;
    }
};
