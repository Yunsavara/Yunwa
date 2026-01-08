const readline = require("readline");

/**
 * Prompt input terminal helper
 * @param {string} prompt - The prompt message to display
 * @returns {Promise<string>} User input
 */
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

module.exports = question;
