require('dotenv').config();
const gameConfig = require('../gameconfig.json');
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const clientId = process.env.CLIENT_ID;
const guildIds = gameConfig.guildIds; // dictionary of guilds
const token = process.env.DISCORD_TOKEN;

const commands = [];

// Grab all the command folders from the commands directory
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			commands.push(command.data.toJSON());
		} else {
			console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

const rest = new REST().setToken(token);

async function clearGlobalCommands() {
	try {
		await rest.put(Routes.applicationCommands(clientId), { body: [] });
		console.log('Cleared all global application commands.');
	} catch (error) {
		console.error('Error clearing global commands:', error);
	}
}

(async () => {
	if (process.argv.includes('--clear-global')) {
		await clearGlobalCommands();
		return;
	}

	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// Deploy to all guilds in the dictionary
		for (const [name, guildId] of Object.entries(guildIds)) {
			const data = await rest.put(
				Routes.applicationGuildCommands(clientId, guildId),
				{ body: commands },
			);
			console.log(`✅ Successfully reloaded ${data.length} commands in guild ${name} (${guildId})`);
		}

	} catch (error) {
		console.error('Error reloading commands:', error);
	}
})();