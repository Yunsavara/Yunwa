module.exports = async (yunwa, m) => {
    const msg = m.messages[0];

    if (!msg.message) return;

    // Ignore pesan dari bot sendiri
    if (msg.key.fromMe) return;

    const body =
        msg.message.conversation || msg.message.extendedTextMessage?.text || "";

    const sender = msg.key.remoteJid;
    const pushname = msg.pushName || "Yunwa";

    // prefix bot Yunwa
    if (!body.startsWith("!")) return;

    // commands execution
    const command = body.slice(1).trim().toLowerCase();

    // log inputed message (cuma yang pakai prefix !)
    console.log(`✓ Perintah diterima: ${command} dari ${pushname}`);

    // features
    try {
        switch (command) {
            case "halo":
                await yunwa.sendMessage(sender, { text: "Halo juga beb!" });
                console.log("✓ Respon 'halo' terkirim");
                break;
            case "ping":
                await yunwa.sendMessage(sender, { text: "Pong!" });
                console.log("✓ Respon 'ping' terkirim");
                break;
            default:
                console.log(`⚠ Command '${command}' tidak dikenali`);
        }
    } catch (error) {
        console.error("✗ Error mengirim pesan:", error);
    }
};
