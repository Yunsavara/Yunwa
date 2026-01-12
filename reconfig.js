/**
 * Standalone reconfigure script
 * Run with: node reconfig.js
 */

require("dotenv").config();
const chalk = require("chalk");
const { reconfigureMenu } = require("./utils/setup");

async function main() {
    console.log(chalk.bgCyan.black("\n Yunwa - Reconfiguration Tool \n"));

    try {
        await reconfigureMenu();
    } catch (error) {
        console.error(chalk.red("Error during reconfiguration:"), error);
        process.exit(1);
    }

    console.log(chalk.cyan("\nDone! You can now restart the bot.\n"));
    process.exit(0);
}

main();
