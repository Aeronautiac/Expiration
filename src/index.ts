require("dotenv").config();
import fs from "node:fs";
import path from "node:path";
import {
    Client,
    Collection,
    IntentsBitField,
    GatewayIntentBits,
} from "discord.js";
import { connectMongoose } from "./mongoose";
import agenda from "./jobs";
import polls from "./core/polls";

const token = process.env.DISCORD_TOKEN;

process.on("uncaughtException", (err) => {
    console.error("[UNCAUGHT EXCEPTION]", err);
});
process.on("unhandledRejection", (reason, promise) => {
    console.error("[UNHANDLED REJECTION]", reason);
});

connectMongoose();

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessageReactions,
        IntentsBitField.Flags.MessageContent,
    ],
});

// load core
const coreFolder = path.join(__dirname, "core");
const coreFiles = fs
    .readdirSync(coreFolder)
    .filter((fileName: string) => fileName.endsWith(".js"));
for (const fileName of coreFiles) {
    const filePath = path.join(coreFolder, fileName);
    const required = require(filePath);
    const module = required.default ?? required;
    if (module.init) {
        try {
            module.init(client);
        } catch {
            console.log(
                `[WARNING] The core file ${fileName} has failed to initialize.`
            );
        }
    }
}

// load commands
export const commands = new Collection();
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs
        .readdirSync(commandsPath)
        .filter((file: string) => file.endsWith(".js"));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const commandModule = require(filePath);
        const command = commandModule.default ?? commandModule;
        if (command.data && command.execute) {
            commands.set(command.data.name, command);
        } else {
            console.log(
                `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
            );
        }
    }
}

// load events
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file: string) => file.endsWith(".js"));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const eventModule = require(filePath);
    const event = eventModule.default ?? eventModule;
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

client.login(token);
