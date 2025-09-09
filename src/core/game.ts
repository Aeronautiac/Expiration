import { Channel, ChannelType, Client, Guild, Role } from "discord.js";
import names from "./names";
import { config } from "../configs/config";
import access from "./access";
import notebooks from "./notebooks";

import Player from "../models/playerts";
import Notebook from "../models/notebookts";
import contacting from "./contacting";
import playerAbilities from "./playerAbilities";
import { RoleName } from "../configs/roles";
import Season, { SeasonFlag } from "../models/seasonts";
import { Result, success, failure } from "../types/Result";
import mongoose from "mongoose";
import Bug from "../models/bug";
import { CategoryPrefixName } from "../configs/categoryPrefixes";
import util from "./util";

let client: Client;

async function resetDatabase() {
    const collections = await mongoose.connection.db
        .listCollections()
        .toArray();

    for (const collection of collections) {
        if (collection.name !== "config") {
            await mongoose.connection.dropCollection(collection.name);
        }
    }
}

const game = {
    init: function (newClient: Client) {
        client = newClient;
    },

    // creates a player's data if there is none, gives the player the role specified, and revives them if they were dead
    // also returns their notebooks if they owned any and their notebooks were not taken from them
    // bans from all guilds except main. Unbans and invites to role guilds.
    async role(
        userId: string,
        role: RoleName,
        trueName?: string
    ): Promise<void> {
        let playerData = await Player.findOne({ userId });
        const user = await client.users.fetch(userId);

        if (!playerData) {
            const name =
                names.toReadable(trueName) ?? (await names.getUnique());

            playerData = await Player.create({
                userId,
                role,
                trueName: names.toInternal(name),
                contactTokens: config.dailyContactTokens,
            });

            await user.send(`Your true name is ${names.toReadable(name)}`);
        } else {
            await Player.updateOne(
                { userId },
                {
                    $set: { "flags.alive": true, role },
                }
            );

            const ownedNotebooks = await Notebook.find({
                currentOwner: userId,
            });
            for (const notebook of ownedNotebooks) {
                try {
                    await notebooks.setOwner(notebook.guildId, userId);
                } catch (err) {
                    console.log(
                        "Failed to return notebook after revival:",
                        err
                    );
                }
            }
        }

        // restricts access to all guilds except main (this is called no matter what because your role could change even while alive.)
        await access.revokeAll(userId);

        // grants access to role guilds and abilities
        await playerAbilities.giveRoleAbilities(userId);
        await access.grantRole(userId);

        await contacting.removeLoungeHider(userId, "dead");

        // roles
        const mainGuild = await client.guilds.fetch(config.guilds.main);
        const member = await mainGuild.members.fetch(userId).catch(() => null);
        if (member) {
            await member.roles
                .add(config.discordRoles.Civilian)
                .catch(console.error);
            await member.roles
                .remove(config.discordRoles.Shinigami)
                .catch(console.error);
        }
    },

    async newSeason() {
        const existingSeason = await Season.findOne({});
        if (existingSeason) return failure("A season already exists.");

        await Season.create({});

        return success(
            "Successfully created a new season. Run /startseason to begin."
        );
    },

    async startSeason() {
        const season = await Season.findOne({});
        if (!season)
            return failure("No season exists. Create one with /newseason.");

        season.flags.set("active", true);
        await season.save();

        return success("Season started. Run /endseason to end.");
    },

    async endSeason() {
        const season = await Season.findOne({});
        if (!season)
            return failure("No season exists. Create one with /newseason.");

        season.flags.set("active", false);
        await season.save();

        return success(
            "Season ended. Run /cleanslate to clear all data, messages, and channels that are associated with the season."
        );
    },

    async cleanSlate() {
        await resetDatabase();

        return success(
            "The season has been cleared. You may now create a new season with /newseason."
        );
    },

    async createDefaultOrganisations() {},

    async resetContactTokens() {},

    async startBlackout() {},

    async stopBlackout() {},

    async nextDay() {},

    async kill() {},

    async deathMessage() {},

    async applyCustody() {},

    async removeCustody() {},

    async announce() {},

    async incarcerate() {},

    async removeIncarcerated() {},

    async kidnap() {},

    async releaseKidnap() {},

    async removeIPPs() {},

    async bug(
        targetId: string,
        source: string,
        buggedBy?: string
    ): Promise<void> {
        const target = await client.users.fetch(targetId);

        const newBug = await Bug.create({
            buggedBy,
            targetId,
            source,
        });

        const alias = await names.getAlias(targetId);
        const newChannelName = `${source}-${alias}`;

        const logChannelWatari = await util.createTemporaryChannel(
            config.guilds.lwatari,
            newChannelName,
            config.categoryPrefixes.buglog
        );
        if (source === "bug") {
            const logChannelStolen = await util.createTemporaryChannel(
                config.guilds.watarilaptop,
                newChannelName,
                config.categoryPrefixes.stolenbuglog
            );
            newBug.channelIds.set("stolen", logChannelStolen.id);
        }
        newBug.channelIds.set("watari", logChannelWatari.id);
        await newBug.save();

        let notifierMessage = (() => {
            if (source === "bug") return `You have been bugged.`;
            if (source === "custody")
                return `You have been placed into custody.`;
            return "";
        })();
        let viewableBy = (() => {
            if (source === "bug") return "the person who bugged you";
            if (source === "custody") return "L and Watari";
            return "";
        })();
        notifierMessage += `\nAs a result, anything you send in shared channels will be viewable by ${viewableBy}.
    \nA shared channel is any channel which is not solely visible to you at all times.`;

        try {
            await target.send(notifierMessage);
        } catch (err) {
            console.log("Failed to notify user of bug.", err);
        }
    },

    async removeBugs() {

    },
};

export default game;
