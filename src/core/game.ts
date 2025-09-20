import { Client, Message, PermissionOverwriteOptions } from "discord.js";
import names from "./names";
import { config } from "../configs/config";
import access from "./access";
import notebooks from "./notebooks";

import Player, { IPlayerDocument, PlayerFlag } from "../models/player";
import Notebook from "../models/notebook";
import abilities from "./abilities";
import { RoleName } from "../configs/roles";
import Season, { SeasonFlag } from "../models/season";
import { Result, success, failure } from "../types/Result";
import mongoose, { ObjectId, Schema } from "mongoose";
import Bug, { IBugDocument } from "../models/bug";
import util, { ChannelPerms } from "./util";
import { OrganisationName, organisations } from "../configs/organisations";
import Kidnapping from "../models/kidnapping";
import agenda from "../jobs";
import orgs from "./orgs";
import { DiscordRoleName } from "../configs/discordRoles";

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
            const name = trueName
                ? names.toReadable(trueName)
                : await names.getUnique();

            playerData = await Player.create({
                userId,
                role,
                trueName: names.toInternal(name),
                contactTokens: config.dailyContactTokens,
                flags: new Map([["alive", true]]),
            });

            await user.send(`Your true name is **${names.toReadable(name)}**`);

            // create monologue
            await game.createMonologue(userId);
        } else {
            // revive them
            await Player.updateOne(
                { userId },
                {
                    $set: { "flags.alive": true, role },
                }
            );
            await util.removeState(userId, "dead");

            // if there is a temporary owner, the notebook should be returned by the end of the day, so we ignore these types of notebooks
            const ownedNotebooks = [];
            const currOwnerNotebooks = await Notebook.find({
                currentOwner: userId,
                temporaryOwner: { $in: [null, "", undefined] },
            });

            // if they still have a temporary book for some reason then give that back as well
            const tempOwnerNotebooks = await Notebook.find({
                temporaryOwner: userId,
            });

            ownedNotebooks.push(...currOwnerNotebooks, ...tempOwnerNotebooks);
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
        await access.revokeChannels(userId);

        // grants access to role guilds, abilities, and channels
        await access.grantRole(userId);
        await access.grantGroup(userId);
        await access.grantChannels(userId);
        await abilities.giveRoleAbilities(userId);

        // roles
        const mainGuild = await client.guilds.fetch(config.guilds.main);
        const member = await mainGuild.members
            .fetch(userId)
            .catch(console.error);
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
        await orgs.createDefaults();

        return success(
            "Successfully created a new season. Run /startseason to begin."
        );
    },

    async startSeason() {
        const season = await Season.findOne({});
        if (!season)
            return failure("No season exists. Create one with /newseason.");

        await Season.updateOne({}, { "flags.active": true });

        return success("Season started. Run /endseason to end.");
    },

    async endSeason() {
        const season = await Season.findOne({});
        if (!season)
            return failure("No season exists. Create one with /newseason.");

        await Season.updateOne({}, { "flags.active": false });

        return success(
            "Season ended. Run /cleanslate to clear all data, messages, and channels that are associated with the season."
        );
    },

    async cleanSlate() {
        await util.deleteTemporaryChannels();
        await resetDatabase();
        return success(
            "The season has been cleared. You may now create a new season with /newseason."
        );
    },

    async createMonologue(userId: string) {
        const userData = await Player.findOne({ userId });
        if (!userData) throw new Error("Player does not exist.");

        // if they already have a monologue for some reason then don't dont make another
        if (userData.monologueChannelId) return;

        const monologueChannel = await util.createTemporaryChannel(
            config.guilds.main,
            `${await names.getDisplay(userId)}-monologue`,
            config.categoryPrefixes.monologue,
            [
                {
                    ids: [userId],
                    perms: config.monologueChannelPermissions,
                },
                {
                    ids: [config.discordRoles.Spectator],
                    perms: config.spectatorPermissions,
                },
            ],
            true
        );

        // add it to their data
        await Player.updateOne(
            { userId },
            { monologueChannelId: monologueChannel.id }
        );

        // send monologue intro message
        if (monologueChannel.isSendable())
            await monologueChannel.send(
                `<@${userId}> this is your monologue channel. It is a completely private channel where you can write down your thoughts or store any information you might find useful. You may do whatever you wish with it.`
            );
    },

    async resetContactTokens() {
        await Player.updateMany(
            {},
            { contactTokens: config.dailyContactTokens }
        );
    },

    // just make news and courtroom unviewable. all else is manually handled.
    async startBlackout(duration?: number) {
        const mainGuild = await client.guilds.fetch(config.guilds.main);
        const settings: ChannelPerms = {
            ids: [mainGuild.roles.everyone.id],
            perms: {
                ViewChannel: false,
            },
        };
        await util.addPermissionsToChannel(config.channels.courtroom, [
            settings,
        ]);
        await util.addPermissionsToChannel(config.channels.news, [settings]);

        await Season.updateOne(
            {},
            {
                $set: { "flags.blackout": true },
            }
        );

        // schedule agenda job
        await agenda.schedule(
            new Date(Date.now() + util.hrsToMs(duration)),
            "endBlackout",
            {}
        );
    },

    async endBlackout() {
        const mainGuild = await client.guilds.fetch(config.guilds.main);
        const settings: ChannelPerms = {
            ids: [mainGuild.roles.everyone.id],
            perms: {
                ViewChannel: true,
            },
        };
        await util.addPermissionsToChannel(config.channels.courtroom, [
            settings,
        ]);
        await util.addPermissionsToChannel(config.channels.news, [settings]);

        await Season.updateOne(
            {},
            {
                $set: { "flags.blackout": false },
            }
        );

        // if agenda job exists, cancel
        await agenda.cancel({ name: "endBlackout" });
    },

    async nextDay() {
        await game.removeExplicitBugs();
        await Player.updateMany(
            { "flags.underTheRadar": true },
            { $unset: { "flags.underTheRadar": "" } }
        );
        await game.resetContactTokens();
        await game.removeIPPs();
        await abilities.progressCooldowns();
        await notebooks.resetDailyUsage();
        await notebooks.returnNotebooks();
        await Season.updateOne({}, { $inc: { day: 1 } });
    },

    async unlock2ndKira() {
        await Player.updateMany(
            { role: "2nd Kira" },
            { $set: { "flags.kiraConnection": true } }
        );
    },

    async custody(userId: string) {
        // add custody state
        await util.addState(userId, "custody");

        // give them the custody bug
        await game.bug(userId, "custody");

        // add custody role
        const mainGuild = await client.guilds.fetch(config.guilds.main);
        const member = await mainGuild.members.fetch(userId).catch(() => null);
        if (member)
            await member.roles
                .add(config.discordRoles.Custody)
                .catch(console.error);
    },

    async removeCustody(userId: string) {
        // remove custody state
        await util.removeState(userId, "custody");

        // remove custody bug
        await Bug.deleteMany({ targetId: userId, source: "custody" });

        // remove custody role
        const mainGuild = await client.guilds.fetch(config.guilds.main);
        const member = await mainGuild.members.fetch(userId).catch(() => null);
        if (member)
            await member.roles
                .remove(config.discordRoles.Custody)
                .catch(console.error);
    },

    async announce(message: string): Promise<Message> {
        const mainGuild = await client.guilds.fetch(config.guilds.main);
        const channel = await mainGuild.channels.fetch(config.channels.news);
        if (channel && channel.isTextBased())
            return await channel.send(message);
        throw new Error("News channel not found.");
    },

    async incarcerate(
        userId: string,
        args: {
            duration?: number;
            message?: string;
        } = {}
    ) {
        // add incarcerated state
        await util.addState(userId, "incarcerated");

        // if there is a duration, schedule their release
        if (args.duration) {
            const releaseAt = new Date(
                Date.now() + util.hrsToMs(args.duration)
            );
            await agenda.schedule(releaseAt, "releaseIncarcerated", {
                userId,
            });
        }

        // if there was a message, announce it
        if (args.message) await game.announce(args.message);

        // add incarcerated role and remove civilian role
        const mainGuild = await client.guilds.fetch(config.guilds.main);
        const member = await mainGuild.members.fetch(userId).catch(() => null);

        await member?.roles
            .add(config.discordRoles.Incarcerated)
            .catch(console.error);
        await member?.roles
            .remove(config.discordRoles.Civilian)
            .catch(console.error);
    },

    async removeIncarcerated(userId: string, announce?: boolean) {
        const userData = await Player.findOne({ userId });
        if (!userData) throw new Error("Player does not exist.");

        // remove incarcerated state
        await util.removeState(userId, "incarcerated");

        // if announced, announce it
        if (announce)
            await game.announce(
                `@everyone <@${userId}> has served their time and has now returned to society.`
            );

        // if a release was scheduled, then cancel it
        await agenda.cancel({ name: "releaseIncarcerated", data: { userId } });

        // remove incarcerated role and add civilian role
        const mainGuild = await client.guilds.fetch(config.guilds.main);
        const member = await mainGuild.members.fetch(userId).catch(() => null);

        if (member) {
            // remove incarcerated role
            await member.roles
                .remove(config.discordRoles.Incarcerated)
                .catch(console.error);
            // add civilian role (only if they are still alive)
            await util.addRoleIfAlive(userId, "Civilian");
        }
    },

    async kidnap(
        userId: string,
        guildId: string,
        args: {
            duration?: number;
            kidnapperId?: string;
            kidnapperOrg?: OrganisationName;
            announce?: boolean;
        } = {}
    ) {
        const mainGuild = await client.guilds.fetch(config.guilds.main);
        // if there is a kidnapperId, it is a public kidnapping, otherwise it is an anonymous kidnapping
        const anonymous = !args.kidnapperId;

        // add kidnapped state
        await util.addState(userId, "kidnapped");

        // create channels and set loggable
        const kidnapperChannel = await util.createTemporaryChannel(
            guildId,
            `${await names.getAlias(userId)}-${
                anonymous ? "anonymous" : "public"
            }`,
            config.categoryPrefixes.kidnap,
            [
                {
                    ids: [mainGuild.roles.everyone.id],
                    perms: config.loungeMemberPermissions,
                },
            ]
        );
        await util.setChannelLoggable(kidnapperChannel.id);
        const kidnappedChannel = await util.createTemporaryChannel(
            config.guilds.main,
            `${await names.getAlias(userId)}-${
                anonymous ? "anonymous" : "public"
            }`,
            config.categoryPrefixes.kidnap,
            [{ ids: [userId], perms: config.loungeMemberPermissions }],
            true
        );
        await util.setChannelLoggable(kidnappedChannel.id);

        // create kidnap data entry
        await Kidnapping.create({
            victimId: userId,
            kidnapperId: args.kidnapperId,
            kidnapperChannelId: kidnapperChannel.id,
            kidnappedChannelId: kidnappedChannel.id,
        });

        // if there is a duration, schedule their release
        if (args.duration) {
            const releaseAt = new Date(
                Date.now() + util.hrsToMs(args.duration)
            );
            await agenda.schedule(releaseAt, "kidnapRelease", {
                userId,
            });
        }

        // announcement
        if (args.announce) {
            let announceMessage = `@everyone <@${userId}> has been kidnapped`;
            if (args.kidnapperOrg) {
                const orgConfig = config.organisations[args.kidnapperOrg];
                const article = orgConfig["article"]
                    ? ` ${orgConfig["article"]} `
                    : "";
                announceMessage += ` by ${article}<@&${
                    config.discordRoles[args.kidnapperOrg]
                }>`;
            }

            announceMessage += `. Authorities have begun rescue efforts, but it may be a while before they succeed.`;
            await game.announce(announceMessage);
        }
    },

    async kidnapRelease(userId: string) {
        const userData = await Player.findOne({ userId });
        if (!userData) throw new Error("Player does not exist.");

        // remove kidnapped state
        await util.removeState(userId, "kidnapped");

        // remove kidnapped role
        const mainGuild = await client.guilds.fetch(config.guilds.main);
        const member = await mainGuild.members.fetch(userId).catch(() => null);
        await member?.roles
            .remove(config.discordRoles.Kidnapped)
            .catch(console.error);

        // add civilian role (only if they are still alive)
        await util.addRoleIfAlive(userId, "Civilian");

        const kidnapData = await Kidnapping.findOne({ victimId: userId });
        if (!kidnapData) return;

        // if a release was scheduled, then cancel it
        await agenda.cancel({ name: "kidnapRelease", data: { userId } });

        // delete data but save id
        const kidnapperId = kidnapData.kidnapperId;
        await Kidnapping.deleteOne({ victimId: userId });

        // if the victim is still alive, announce their release
        // if the kidnapping was public, then reveal the kidnapper in this announcement
        if (!userData.flags.get("alive")) return;
        const releaseMessage = await game.announce(
            `@everyone <@${userId}> has been rescued by authorities.`
        );
        await util.sleep(config.announcementDelay);
        if (kidnapData.kidnapperId)
            await releaseMessage.reply(
                `When questioned, they identified their kidnapper as <@${kidnapperId}>.`
            );
        else
            await releaseMessage.reply(
                `When questioned, they were unable to identify their kidnapper.`
            );
        await util.sleep(config.announcementDelay);
        await releaseMessage.reply(
            `They have returned to society and can now continue their life as normal.`
        );
    },

    async removeIPPs() {
        // remove ipp from nicknames
        const ippPlayers = await Player.find({ "flags.ipp": true });
        const promises = ippPlayers.map(async (player) => {
            const display = await names.getDisplay(player.userId);
            const cleanName = display.replace(/\s*\(IPP\)$/, "");
            await names.setNick(player.userId, cleanName);
        });
        await Promise.allSettled(promises);

        // remove flags
        await Player.updateMany(
            { "flags.ipp": true },
            { $set: { "flags.ipp": false } }
        );
    },

    async addBugAsterisk(userId: string) {
        const displayName = await names.getDisplay(userId);
        let newName: string;
        if (displayName.includes("*")) return displayName; // prevent double asterisk
        const match = displayName.match(/\s\([^)]+\)$/);
        if (match) {
            newName = displayName.replace(match[0], `*${match[0]}`);
        } else {
            newName = displayName + "*";
        }
        await names.setNick(userId, newName);
    },

    async bug(
        targetId: string,
        source: string,
        buggedBy?: string
    ): Promise<void> {
        const target = await client.users.fetch(targetId);

        const newBug = await Bug.create({
            targetId,
            source,
            buggedBy,
        });

        const alias = await names.getAlias(targetId);
        const newChannelName = `${source}-${alias}`;

        const bugLogPerms: PermissionOverwriteOptions = {
            ViewChannel: true,
            SendMessages: false,
        };

        const lwatariGuild = await client.guilds.fetch(config.guilds.lwatari);
        const logChannelWatari = await util.createTemporaryChannel(
            config.guilds.lwatari,
            newChannelName,
            config.categoryPrefixes.buglog,
            [
                {
                    ids: [lwatariGuild.roles.everyone.id],
                    perms: bugLogPerms,
                },
            ]
        );
        if (source === "bug") {
            const watarisStolenLaptopGuild = await client.guilds.fetch(
                config.guilds.watarilaptop
            );
            const logChannelStolen = await util.createTemporaryChannel(
                config.guilds.watarilaptop,
                newChannelName,
                config.categoryPrefixes.stolenbuglog,
                [
                    {
                        ids: [watarisStolenLaptopGuild.roles.everyone.id],
                        perms: bugLogPerms,
                    },
                ]
            );

            // always relay to stolen laptop if it's a normal bug
            newBug.channelIds.set("stolen", logChannelStolen.id);

            // only relay to L and Watari if the bug was created by Watari
            const buggedByData = await Player.findOne({ userId: buggedBy });
            if (buggedByData.role === "Watari")
                newBug.channelIds.set("watari", logChannelWatari.id);

            // add a bug asterisk to the target's name
            await game.addBugAsterisk(targetId).catch(console.error);
        }

        // always relay to L and Watari even if Watari is dead if it's a custody bug
        if (source === "custody")
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
        notifierMessage += `\nAs a result, anything you send in shared channels will be viewable by ${viewableBy}.`;
        notifierMessage += `\nA shared channel is any channel which is not solely visible to you at all times.`;

        try {
            await target.send(notifierMessage);
        } catch (err) {
            console.log("Failed to notify user of bug.", err);
        }
    },

    async removeExplicitBugs() {
        const bugs = await Bug.find({
            source: "bug",
        });
        const buggedPlayers: IPlayerDocument[] = [];

        // find bugged players (to remove asterisk later)
        for (const log of bugs) {
            const player = await Player.findOne({ userId: log.targetId });
            if (
                player &&
                !buggedPlayers.find((p) => p.userId === player.userId)
            )
                buggedPlayers.push(player);
        }

        // delete bug data entries
        await Bug.deleteMany({ source: "bug" });

        // remove asterisks
        const promises = buggedPlayers.map(async (player) => {
            const display = await names.getDisplay(player.userId);
            const cleanName = display.replace(/\*/g, "");
            await names.setNick(player.userId, cleanName);
        });
        await Promise.allSettled(promises);
    },
};

export default game;
