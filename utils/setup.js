const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const question = require("./question");

const ENV_PATH = path.join(__dirname, "../.env");
const SESSION_PATH = path.join(__dirname, "../YunwaSession");

/**
 * Check if .env exists and has required keys
 */
function checkEnvExists() {
    if (!fs.existsSync(ENV_PATH)) {
        return false;
    }

    const envContent = fs.readFileSync(ENV_PATH, "utf8");

    // Check if API keys are set (not empty)
    const hasGroqKey =
        envContent.includes("GROQ_API_KEY=") &&
        !envContent.includes("GROQ_API_KEY=your_");
    const hasTavilyKey =
        envContent.includes("TAVILY_API_KEY=") &&
        !envContent.includes("TAVILY_API_KEY=your_");

    return hasGroqKey && hasTavilyKey;
}

/**
 * Read current .env content as object
 */
function readEnvConfig() {
    if (!fs.existsSync(ENV_PATH)) {
        return {};
    }

    const envContent = fs.readFileSync(ENV_PATH, "utf8");
    const config = {};

    envContent.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
            const [key, ...valueParts] = trimmed.split("=");
            config[key] = valueParts.join("=");
        }
    });

    return config;
}

/**
 * Write env config to .env file
 */
function writeEnvConfig(config) {
    let envContent = "";

    const keys = ["GROQ_API_KEY", "TAVILY_API_KEY", "RESITA_API_KEY"];

    keys.forEach((key) => {
        if (config[key]) {
            envContent += `${key}=${config[key]}\n`;
        } else {
            envContent += `# ${key}=your_${key.toLowerCase()}_here\n`;
        }
    });

    fs.writeFileSync(ENV_PATH, envContent);
}

/**
 * Delete session folder recursively
 */
function deleteSessionFolder() {
    if (fs.existsSync(SESSION_PATH)) {
        fs.rmSync(SESSION_PATH, { recursive: true, force: true });
        console.log(chalk.yellow("✓ Session folder deleted"));
    }
}

/**
 * Interactive setup wizard (first time)
 */
async function runSetupWizard() {
    console.log(chalk.bgCyan.black("\n Yunwa Bot - First Time Setup \n"));
    console.log(chalk.yellow("This bot requires API Keys (100% FREE!):\n"));

    console.log(chalk.green("1. Groq API Key (Required)"));
    console.log(chalk.gray("   → Sign up at: https://console.groq.com/keys"));
    console.log(chalk.gray("   → Click 'Create API Key', copy token\n"));

    console.log(chalk.green("2. Tavily API Key (Required for web search)"));
    console.log(chalk.gray("   → Sign up at: https://tavily.com/"));
    console.log(chalk.gray("   → Free 1000 searches/month\n"));

    console.log(chalk.green("3. Resita API Key (Optional)"));
    console.log(chalk.gray("   → Sign up at: https://api.ferdev.my.id/docs\n"));

    console.log(chalk.cyan("Let's setup your API keys!\n"));

    // Get Groq API Key
    const groqKey = await question(
        chalk.yellow("Enter Groq API Key (or type 'skip'): "),
    );

    // Get Tavily API Key
    const tavilyKey = await question(
        chalk.yellow("Enter Tavily API Key (or type 'skip'): "),
    );

    // Get Resita API Key
    const resitaKey = await question(
        chalk.yellow("Enter Resita API Key (or type 'skip'): "),
    );

    // Create config object
    const config = {};

    if (groqKey.toLowerCase() !== "skip") {
        config.GROQ_API_KEY = groqKey.trim();
    }

    if (tavilyKey.toLowerCase() !== "skip") {
        config.TAVILY_API_KEY = tavilyKey.trim();
    }

    if (resitaKey.toLowerCase() !== "skip") {
        config.RESITA_API_KEY = resitaKey.trim();
    }

    writeEnvConfig(config);

    console.log(chalk.green("\n✓ Setup completed!"));

    if (
        groqKey.toLowerCase() === "skip" ||
        tavilyKey.toLowerCase() === "skip"
    ) {
        console.log(
            chalk.yellow("\n⚠️  Some features won't work without API keys."),
        );
    }

    console.log(chalk.cyan("Bot will start in 3 seconds...\n"));
    await new Promise((resolve) => setTimeout(resolve, 3000));
}

/**
 * Re-configure specific API key
 */
async function reconfigureApiKey(keyName) {
    const config = readEnvConfig();

    console.log(chalk.cyan(`\n Reconfiguring ${keyName} \n`));

    const currentValue = config[keyName] || "not set";
    console.log(chalk.gray(`Current value: ${currentValue}\n`));

    const newValue = await question(
        chalk.yellow(`Enter new ${keyName} (or 'cancel'): `),
    );

    if (newValue.toLowerCase() === "cancel") {
        console.log(chalk.yellow("Cancelled."));
        return false;
    }

    if (newValue.trim()) {
        config[keyName] = newValue.trim();
        writeEnvConfig(config);
        console.log(chalk.green(`\n✓ ${keyName} updated successfully!`));
        return true;
    } else {
        console.log(chalk.red("Invalid value. Cancelled."));
        return false;
    }
}

/**
 * Full reset - delete session and reconfigure all keys
 */
async function fullReset() {
    console.log(chalk.bgRed.white("\n FULL RESET \n"));
    console.log(
        chalk.yellow(
            "⚠️  This will delete your WhatsApp session and reset all API keys!",
        ),
    );

    const confirm = await question(chalk.red("Type 'CONFIRM' to proceed: "));

    if (confirm !== "CONFIRM") {
        console.log(chalk.yellow("Cancelled."));
        return false;
    }

    // Delete session folder
    deleteSessionFolder();

    // Run setup wizard
    await runSetupWizard();

    console.log(
        chalk.green("\n✓ Full reset completed! Please restart the bot."),
    );
    return true;
}

/**
 * Interactive reconfigure menu
 */
async function reconfigureMenu() {
    console.log(chalk.bgCyan.black("\n Yunwa Bot - Reconfigure \n"));
    console.log(chalk.cyan("Choose an option:\n"));
    console.log(chalk.white("1. Change Groq API Key"));
    console.log(chalk.white("2. Change Tavily API Key"));
    console.log(chalk.white("3. Change Resita API Key"));
    console.log(chalk.red("4. Full Reset (Delete session + Reset all keys)"));
    console.log(chalk.gray("5. Cancel\n"));

    const choice = await question(chalk.yellow("Enter choice (1-5): "));

    switch (choice) {
        case "1":
            return await reconfigureApiKey("GROQ_API_KEY");
        case "2":
            return await reconfigureApiKey("TAVILY_API_KEY");
        case "3":
            return await reconfigureApiKey("RESITA_API_KEY");
        case "4":
            return await fullReset();
        case "5":
            console.log(chalk.yellow("Cancelled."));
            return false;
        default:
            console.log(chalk.red("Invalid choice."));
            return false;
    }
}

/**
 * Main setup check
 */
async function setupCheck() {
    if (!checkEnvExists()) {
        await runSetupWizard();
    }
}

module.exports = {
    setupCheck,
    checkEnvExists,
    reconfigureMenu,
    reconfigureApiKey,
    fullReset,
    readEnvConfig,
};
