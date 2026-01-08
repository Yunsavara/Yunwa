const chalk = require("chalk");
const { createConnection } = require("./config/connection");
const { setupConnectionHandler } = require("./handlers/connection-handler");
const { setupMessageHandler } = require("./handlers/message-handler");

/**
 * Main function to connect to WhatsApp
 */
async function connectToWhatsapp() {
    try {
        // Create WhatsApp connection
        const yunwa = await createConnection();

        // Setup event handlers
        setupConnectionHandler(yunwa, connectToWhatsapp);
        setupMessageHandler(yunwa);

        console.log(chalk.green("✓ Bot handlers initialized successfully"));
    } catch (error) {
        console.error(chalk.red("✗ Error connecting to WhatsApp:"), error);
        process.exit(1);
    }
}

// Start the bot
console.log(chalk.bgCyan.black("\n 🤖 Starting Yunwa Bot... \n"));
connectToWhatsapp();
