import { Client, Guild } from "discord.js";
import fs from "fs";
import { config } from "../configs/config";
import Player from "../models/player";

let client: Client;
const first_names = fs
    .readFileSync("./first_names.txt", "utf-8")
    .split("\n")
    .filter(Boolean);
const last_names = fs
    .readFileSync("./last_names.txt", "utf-8")
    .split("\n")
    .filter(Boolean);

const names = {
    init(c: Client): void {
        client = c;
    },

    // returns a random unique name that is not currently in use by any player
    async getUnique(): Promise<string> {
        const usedNames = await Player.distinct("trueName");

        let fullName: string;
        while (true) {
            const firstName =
                first_names[Math.floor(Math.random() * first_names.length)];
            const lastName =
                last_names[Math.floor(Math.random() * last_names.length)];

            fullName = `${firstName} ${lastName}`;
            if (!usedNames.includes(names.toInternal(fullName))) break;
        }

        return fullName;
    },

    // returns the user's alias in game
    async getAlias(userId: string): Promise<string> {
        try {
            const mainGuild: Guild = await client.guilds.fetch(
                config.guilds.main
            );
            const member = await mainGuild.members.fetch(userId);
            return member.displayName
                .replace(/\*/g, "")
                .replace(/\s*\(IPP\)$/, "");
        } catch (err) {
            console.warn(`Failed to get alias for user ${userId}`);
            return "";
        }
    },

    // sets the user's nickname to the supplied nickname in all game guilds
    async setNick(userId: string, nickname: string): Promise<void> {
        const promises = Object.entries(config.guilds).map(
            async ([name, id]) => {
                try {
                    const guild = await client.guilds.fetch(id);
                    const member = await guild.members.fetch(userId);
                    await member.setNickname(nickname);
                } catch (err) {
                    console.warn(
                        `Failed to set nickname in guild ${name}:`,
                        err
                    );
                }
            }
        );
        await Promise.all(promises);
    },

    async getDisplay(userId: string) {
        const mainGuild = await client.guilds.fetch(config.guilds.main);
        const member = await mainGuild.members.fetch(userId);
        return member?.displayName;
    },

    // converts a name to a readable, presentable format.
    toReadable(name: string): string {
        return name
            .toLowerCase()
            .trim() // remove leading/trailing spaces and newlines
            .split(/\s+/) // split on any whitespace (spaces, tabs, newlines)
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)) // capitalize first letter of each word
            .join(" "); // join with single space
    },

    // converts a name to an internal format (lowercase, no special characters)
    toInternal(name: string): string {
        return name
            .replace(/[^a-zA-Z\s]/g, "")
            .toLowerCase()
            .trim()
            .replace(/\s+/g, " ");
    },
};

export default names;
