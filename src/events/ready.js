const { Events } = require("discord.js");
const fs = require('node:fs');
const path = require('node:path');

function bold(text) { return `\x1b[1m${text}\x1b[0m`; }
function greenBright(text) { return `\x1b[92m${text}\x1b[0m`; }
function red(text) { return `\x1b[31m${text}\x1b[0m`; }
function yellow(text) { return `\x1b[33m${text}\x1b[0m`; }
function blue(text) { return `\x1b[34m${text}\x1b[0m`; }
function cyan(text) { return `\x1b[36m${text}\x1b[0m`; }

function logCommands(client) {
    const commands = [];
    const foldersPath = path.join(__dirname, '../commands');
    if (fs.existsSync(foldersPath)) {
        const commandFolders = fs.readdirSync(foldersPath);
        for (const folder of commandFolders) {
            const commandsPath = path.join(foldersPath, folder);
            if (fs.existsSync(commandsPath)) {
                const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
                for (const file of commandFiles) {
                    const filePath = path.join(commandsPath, file);
                    const command = require(filePath);
                    if ('data' in command) {
                        commands.push(command.data.name);
                    }
                }
            }
        }
    }
    console.log(bold('Loaded Commands:'));
    commands.forEach(cmd => console.log(greenBright(`- ${cmd}`)));
}

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(cyan('[INFO]'), `Logged in as ${client.user.tag}`);
        logCommands(client);
    },
};
