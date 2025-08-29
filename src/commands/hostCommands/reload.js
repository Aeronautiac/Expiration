const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

function getAllCommandNames() {
    const commandNames = [];
    const foldersPath = path.join(__dirname, '..');
    const commandFolders = fs.readdirSync(foldersPath);
    for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        if (!fs.existsSync(commandsPath)) continue;
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            try {
                const command = require(filePath);
                if (command.data && command.data.name) {
                    commandNames.push(command.data.name);
                }
            } catch {}
        }
    }
    return commandNames;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reload')
        .setDescription('Reload all commands or a specific command.')
        .addStringOption(option =>
            option.setName('command')
                .setDescription('The name of the command to reload (leave blank to reload all)')
                .setRequired(false)
                .setAutocomplete(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async autocomplete(interaction) {
        const focused = interaction.options.getFocused();
        const allCommands = getAllCommandNames();
        const filtered = allCommands.filter(cmd => cmd.startsWith(focused));
        await interaction.respond(
            filtered.map(cmd => ({ name: cmd, value: cmd })).slice(0, 25)
        );
    },
    async execute(interaction) {
        const commandName = interaction.options.getString('command');
        const client = interaction.client;
        let reloaded = [];
        let failed = [];
        if (commandName) {
            // Try to reload a specific command
            let found = false;
            const foldersPath = path.join(__dirname, '..');
            const commandFolders = fs.readdirSync(foldersPath);
            for (const folder of commandFolders) {
                const commandsPath = path.join(foldersPath, folder);
                if (!fs.existsSync(commandsPath)) continue;
                const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
                for (const file of commandFiles) {
                    const filePath = path.join(commandsPath, file);
                    try {
                        const command = require(filePath);
                        if (command.data && command.data.name === commandName) {
                            delete require.cache[require.resolve(filePath)];
                            const newCommand = require(filePath);
                            if (newCommand.data && newCommand.execute) {
                                client.commands.set(newCommand.data.name, newCommand);
                                reloaded.push(newCommand.data.name);
                                found = true;
                            }
                        }
                    } catch (err) {
                        failed.push(`${file}: ${err.message}`);
                    }
                }
            }
            if (!found) {
                await interaction.reply({ content: `Command \\"${commandName}\\" not found.`, ephemeral: true });
                return;
            }
        } else {
            // Reload all commands
            const foldersPath = path.join(__dirname, '..');
            const commandFolders = fs.readdirSync(foldersPath);
            for (const folder of commandFolders) {
                const commandsPath = path.join(foldersPath, folder);
                if (!fs.existsSync(commandsPath)) continue;
                const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
                for (const file of commandFiles) {
                    const filePath = path.join(commandsPath, file);
                    try {
                        delete require.cache[require.resolve(filePath)];
                        const command = require(filePath);
                        if (command.data && command.execute) {
                            client.commands.set(command.data.name, command);
                            reloaded.push(command.data.name);
                        }
                    } catch (err) {
                        failed.push(`${file}: ${err.message}`);
                    }
                }
            }
        }
        let reply = '';
        if (reloaded.length > 0) reply += `Reloaded: ${reloaded.join(', ')}\n`;
        if (failed.length > 0) reply += `Failed: ${failed.join(', ')}\n`;
        if (!reply) reply = 'No commands were reloaded.';
        await interaction.reply({ content: reply, ephemeral: true });
    },
};
