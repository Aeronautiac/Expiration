require("dotenv").config();
import { config } from "./configs/config";
import { REST, Routes } from "discord.js";
import fs from "node:fs";
import path from "node:path";

const clientId = process.env.CLIENT_ID;
const guildIds = config.guilds; // dictionary of guilds
const token = process.env.DISCORD_TOKEN;

const commands = [];

// Grab all the command folders from the commands directory
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs
        .readdirSync(commandsPath)
        .filter((file) => file.endsWith(".js"));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const commandModule = require(filePath);
        const command = commandModule.default ?? commandModule;
        if (command.data && command.execute) {
            commands.push(command.data.toJSON());
        } else {
            console.warn(
                `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
            );
        }
    }
}

const rest = new REST().setToken(token);

async function clearGlobalCommands() {
    try {
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        console.log("Cleared all global application commands.");
    } catch (error) {
        console.error("Error clearing global commands:", error);
    }
}

(async () => {
    if (process.argv.includes("--clear-global")) {
        await clearGlobalCommands();
        return;
    }

    try {
        console.log(
            `Started refreshing ${commands.length} application (/) commands.`
        );

        // Deploy to all guilds in the dictionary
        for (const [name, guildId] of Object.entries(guildIds)) {
            const data = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands }
            );
            if (Array.isArray(data)) {
                console.log(
                    `Reloaded ${data.length} commands in guild ${name} (${guildId})`
                );
            } else {
                console.log(
                    `Unexpected response when reloading commands for ${name}:`,
                    data
                );
            }
        }

        console.log("Finished deploying commands.");
        process.exit(0);
    } catch (error) {
        console.error("Error reloading commands:", error);
        process.exit(1);
    }
})();
