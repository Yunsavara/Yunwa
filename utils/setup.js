const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const question = require("./question");

const ENV_PATH = path.join(__dirname, "../.env");

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
 * Interactive setup wizard
 */
async function runSetupWizard() {
    console.log(chalk.bgCyan.black("\n Yunwa Bot - First Time Setup \n"));
    console.log(chalk.yellow("This bot requires 2 API Keys (100% FREE!):\n"));

    console.log(chalk.green("1. Groq API Key"));
    console.log(chalk.gray("   → Sign up at: https://console.groq.com/keys"));
    console.log(chalk.gray("   → Click 'Create API Key', copy token\n"));

    console.log(chalk.green("2. Tavily API Key (for web search)"));
    console.log(chalk.gray("   → Sign up at: https://tavily.com/"));
    console.log(chalk.gray("   → Free 1000 searches/month\n"));

    console.log(chalk.green("3. Resita API Key"));
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

    // Create .env file
    let envContent = "";

    if (groqKey.toLowerCase() !== "skip") {
        envContent += `GROQ_API_KEY=${groqKey.trim()}\n`;
    } else {
        envContent += `# GROQ_API_KEY=your_groq_api_key_here\n`;
    }

    if (tavilyKey.toLowerCase() !== "skip") {
        envContent += `TAVILY_API_KEY=${tavilyKey.trim()}\n`;
    } else {
        envContent += `# TAVILY_API_KEY=your_tavily_api_key_here\n`;
    }

    if (resitaKey.toLowerCase() !== "skip") {
        envContent += `RESITA_API_KEY=${resitaKey.trim()}\n`;
    } else {
        envContent += `# RESITA_API_KEY=your_resita_api_key_here\n`;
    }

    fs.writeFileSync(ENV_PATH, envContent);

    console.log(chalk.green("\nSetup completed!"));

    if (
        groqKey.toLowerCase() === "skip" ||
        tavilyKey.toLowerCase() === "skip" ||
        resitaKey.toLowerCase() === "skip"
    ) {
        console.log(
            chalk.yellow("\n⚠️  Some features won't work without API keys."),
        );
    }

    console.log(chalk.cyan("Bot will start in 3 seconds...\n"));
    await new Promise((resolve) => setTimeout(resolve, 3000));
}

/**
 * Main setup check
 */
async function setupCheck() {
    if (!checkEnvExists()) {
        await runSetupWizard();
    }
}

module.exports = { setupCheck, checkEnvExists };
