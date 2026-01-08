const fs = require("fs");
const path = require("path");

const commands = {};

// Load all command files from the commands directory
const commandFiles = fs
    .readdirSync(__dirname)
    .filter((file) => file.endsWith(".js") && file !== "index.js");

for (const file of commandFiles) {
    const command = require(path.join(__dirname, file));
    commands[command.name] = command;
}

console.log(
    `✓ Loaded ${Object.keys(commands).length} commands: ${Object.keys(commands).join(", ")}`,
);

module.exports = commands;
