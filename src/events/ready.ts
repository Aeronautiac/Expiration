import { Client, Events } from "discord.js";
import fs from "node:fs";
import path from "node:path";

function bold(text: string) {
    return `\x1b[1m${text}\x1b[0m`;
}
function greenBright(text: string) {
    return `\x1b[92m${text}\x1b[0m`;
}
function red(text: string) {
    return `\x1b[31m${text}\x1b[0m`;
}
function yellow(text: string) {
    return `\x1b[33m${text}\x1b[0m`;
}
function blue(text: string) {
    return `\x1b[34m${text}\x1b[0m`;
}
function cyan(text: string) {
    return `\x1b[36m${text}\x1b[0m`;
}

function logCommands(client: Client) {
    const commands = [];
    const foldersPath = path.join(__dirname, "../commands");
    if (fs.existsSync(foldersPath)) {
        const commandFolders = fs.readdirSync(foldersPath);
        for (const folder of commandFolders) {
            const commandsPath = path.join(foldersPath, folder);
            if (fs.existsSync(commandsPath)) {
                const commandFiles = fs
                    .readdirSync(commandsPath)
                    .filter((file) => file.endsWith(".js"));
                for (const file of commandFiles) {
                    const filePath = path.join(commandsPath, file);
                    const commandModule = require(filePath);
                    const command = commandModule.default ?? commandModule;
                    if (command.data) {
                        commands.push(command.data.name);
                    }
                }
            }
        }
    }
    console.log(bold("Loaded Commands:"));
    commands.forEach((cmd) => console.log(greenBright(`- ${cmd}`)));
}

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client: Client) {
        console.log(cyan("[INFO]"), `Logged in as ${client.user.tag}`);
        logCommands(client);
    },
};
