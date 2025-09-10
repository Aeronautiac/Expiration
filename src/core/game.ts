import {
    Channel,
    ChannelType,
    Client,
    Guild,
    PermissionOverwriteOptions,
    Role,
    TextChannel,
    User,
} from "discord.js";
import names from "./names";
import { config } from "../configs/config";
import access from "./access";
import notebooks from "./notebooks";

import Player, { IPlayerDocument, PlayerFlag } from "../models/playerts";
import Notebook from "../models/notebookts";
import contacting from "./contacting";
import playerAbilities from "./playerAbilities";
import { RoleName } from "../configs/roles";
import Season, { SeasonFlag } from "../models/seasonts";
import { Result, success, failure } from "../types/Result";
import mongoose, { ObjectId, Schema } from "mongoose";
import Bug, { IBugDocument } from "../models/bug";
import { CategoryPrefixName } from "../configs/categoryPrefixes";
import util, { ChannelPerms } from "./util";
import Ability from "../models/ability";
import { OrganisationName } from "../configs/organisations";
import { PlayerStateName } from "../configs/playerStates";
import { GuildName } from "../configs/guilds";
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
            const name =
                names.toReadable(trueName) ?? (await names.getUnique());

            playerData = await Player.create({
                userId,
                role,
                trueName: names.toInternal(name),
                contactTokens: config.dailyContactTokens,
                flags: new Map([["alive", true]]),
            });

            await user.send(`Your true name is ${names.toReadable(name)}`);
        } else {
            // revive them
            await Player.updateOne(
                { userId },
                {
                    $set: { "flags.alive": true, role },
                }
            );
            await util.removeState(userId, "dead");

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

    async resetContactTokens() {
        await Player.updateMany(
            {},
            {
                contactTokens: config.dailyContactTokens,
            }
        );
    },

    async startBlackout() {},

    async stopBlackout() {},

    async nextDay() {
        await game.resetContactTokens();
        await game.removeExplicitBugs();
        await game.removeIPPs();
        await notebooks.returnNotebooks();
        await Season.updateOne(
            {},
            {
                $inc: { day: 1 },
            }
        );
    },

    async kill(
        userId: string,
        args: {
            killerId?: string;
            deathMessage?: string;
            dontSendDeathAnnouncement?: boolean;
            bypassIPP?: boolean;
        } = {}
    ) {
        const userData = await Player.findOne({ userId });
        if (!userData) throw new Error("Player does not exist.");

        // IPP protection
        if (!args.bypassIPP && userData.flags.get("ipp")) return;

        // mark as dead
        await util.addState(userId, "dead");
        userData.flags.set("alive", false);
        await userData.save();

        // delete any bugs where they were the target
        await Bug.deleteMany({ targetId: userId, source: "bug" });

        // remove states like custody, kidnap, ipp
        await game.releaseKidnap(userId);
        await game.removeIncarcerated(userId);
        await game.removeCustody(userId);

        // give discord roles and strip their nickname to their base display name
        const mainGuild = await client.guilds.fetch(config.guilds.main);
        const member = await mainGuild.members.fetch(userId).catch(() => null);
        if (member) {
            await member.roles
                .remove(config.discordRoles.Civilian)
                .catch(console.error);
            await member.roles
                .add(config.discordRoles.Shinigami)
                .catch(console.error);
            await member.roles
                .remove(config.discordRoles.Prosecutor)
                .catch(console.error);
        }
        await names.setNick(userId, await names.getAlias(userId));

        const bugAbility = await Ability.findOne({
            ownerId: userId,
            ability: "bug",
        });
        const ownedNotebooks = await Notebook.find({ currentOwner: userId });

        // handle player kill
        if (args.killerId && args.killerId !== userId) {
            const killerData = await Player.findOne({ userId: args.killerId });
            if (!killerData) throw new Error("Killer does not exist.");

            // transfer notebooks
            const promises = ownedNotebooks.map(async (notebook) => {
                if (notebook.temporaryOwner) return; // don't transfer notebooks that are temporarily owned (i.e. stolen). they will return at the end of the day.
                await notebooks.setOwner(notebook.guildId, args.killerId!);
            });
            await Promise.all(promises);

            // transfer bugs and bug ability
            if (bugAbility) {
                // transfer bugs
                const activeBugs = await Bug.find({ targetId: userId });
                const bugPromises = activeBugs.map(async (bug) => {
                    bug.buggedBy = args.killerId;
                    bug.channelIds.delete("watari"); // remove watari channel if it exists
                    await bug.save();
                });
                await Promise.all(bugPromises);

                // transfer bug ability
                await access.revoke(userId, config.guilds.watarilaptop);
                await access.grant(args.killerId, config.guilds.watarilaptop);
                bugAbility.ownerId = args.killerId;
                await bugAbility.save();
            }

            killerData.playersKilled.push(userId);
            await killerData.save();
        }

        // death announcement
        const wasKilledByPlayer = args.killerId && args.killerId !== userId;
        if (!args.dontSendDeathAnnouncement) {
            await game.announceDeath(userId, {
                trueName: userData.trueName,
                wasKilledByPlayer: wasKilledByPlayer,
                deathMessage: args.deathMessage,
                ownedANotebook: ownedNotebooks.length > 0,
                ownedBugAbility:
                    bugAbility !== undefined && bugAbility !== null,
                role: userData.role,
                affiliations: userData.affiliations,
            });
        }
    },

    async announceDeath(
        userId: string,
        args: {
            wasKilledByPlayer?: boolean;
            deathMessage?: string;
            ownedANotebook?: boolean;
            ownedBugAbility?: boolean;
            trueName: string;
            role: RoleName;
            affiliations?: string[];
        }
    ) {
        const news = (await client.channels.fetch(
            config.channels.news
        )) as TextChannel;
        const user = await client.users.fetch(userId);
        const alias = await names.getAlias(userId);
        const role = args.role;
        const deathReason =
            args.deathMessage ?? `They died to a sudden heart attack`;

        // Compose the base death message
        let output = `@everyone ${user} (${alias}) has died. ${deathReason}`;

        // Send the initial death message
        const deathMsg = await news.send({
            content: output,
            allowedMentions: { parse: ["everyone"] },
        });

        // Wait 5 seconds before replying with the role/affiliation reveal
        await util.sleep(5);

        // Determine the role/affiliation reveal message
        let revealMsg = "";
        const affiliations = args.affiliations ?? [];

        // Helpers for mention formatting
        const roleMention = (r: RoleName) => {
            // Try to find role id from config, fallback to plain text
            const id = config.discordRoles[r];
            return id ? `<@&${id}>` : r;
        };
        const orgMention = (org: OrganisationName) => {
            const id = config.discordRoles[org];
            return id ? `<@&${id}>` : org;
        };

        const revealMessages: Map<RoleName, string> = new Map([
            ["Civilian", "They were just a "],
            ["Kira", "They were the prolific serial killer known as "],
            ["L", "They were the world's greatest detective, "],
            ["Rogue Civilian", "They were the unpredictable "],
            ["Private Investigator", "They were the vengeful "],
            ["News Anchor", "They were the voice of the people, the "],
            ["Beyond Birthday", "They were the enigmatic figure known as "],
            [
                "Watari",
                `They were the genius inventor and ${roleMention(
                    "L"
                )}'s loyal handler, `,
            ],
            [
                "2nd Kira",
                `They were ${roleMention("Kira")}'s most devoted supporter, `,
            ],
        ]);

        const roleAddition = revealMessages.get(role) ?? "They were ";
        revealMsg += roleAddition + roleMention(role);

        const chiefs = affiliations.filter((a) => a.endsWith("Chief"));
        const orgs = affiliations.filter(
            (a) => !a.endsWith("Chief")
        ) as OrganisationName[];

        if (orgs.length === 1 && chiefs.length === 0) {
            // Single org, not chief
            revealMsg += ` and member of the ${orgMention(orgs[0])}.`;
        } else if (orgs.length > 1 && chiefs.length === 0) {
            // Multiple orgs, not chief
            const mentions = orgs.map(orgMention);
            revealMsg += ` and members of the ${mentions
                .slice(0, -1)
                .join(", ")} and ${mentions.slice(-1)}.`;
        } else if (
            orgs.length === 1 &&
            chiefs.length === 1 &&
            chiefs[0].startsWith(orgs[0])
        ) {
            // Chief of their only org
            const chiefOrg = orgs[0];
            revealMsg += ` and the chief of the ${orgMention(
                chiefOrg
            )}. Now no new members may join the ${orgMention(chiefOrg)}.`;
        } else if (orgs.length > 0 && chiefs.length > 0) {
            // Member of orgs and also chief(s)
            const mentions = orgs.map(orgMention);
            let msg = ` and members of the ${mentions.slice(0, -1).join(", ")}${
                orgs.length > 1 ? " and " : ""
            }${mentions.slice(-1)}.`;
            // List all chief roles
            for (const chief of chiefs) {
                const chiefOrg = chief.replace(
                    / Chief$/,
                    ""
                ) as OrganisationName;
                msg += ` They were also the chief of the ${orgMention(
                    chiefOrg
                )}. Now no new members may join the ${orgMention(chiefOrg)}.`;
            }
            revealMsg += msg;
        }

        // Reply to the death message with the reveal
        await deathMsg.reply({
            content: revealMsg,
            allowedMentions: { parse: ["roles"] },
        });

        // If they had a notebook, announce it
        if (args.ownedANotebook) {
            await util.sleep(5);
            await deathMsg.reply({
                content: `Whoever is responsible has now gained possession of their death note(s).`,
            });
        }

        // If they had the bug ability, announce it
        if (args.ownedBugAbility) {
            await util.sleep(5);
            await deathMsg.reply({
                content: `Whoever is responsible has now gained possession of their bug and contact log abilities.`,
            });
        }
    },

    async addRoleIfAlive(userId: string, roleName: DiscordRoleName) {
        const userData = await Player.findOne({ userId });
        if (!userData) throw new Error("Player does not exist.");
        if (!userData.flags.get("alive")) return;
        const mainGuild = await client.guilds.fetch(config.guilds.main);
        const member = await mainGuild.members.fetch(userId).catch(() => null);
        if (member) {
            await member.roles
                .add(config.discordRoles[roleName])
                .catch(console.error);
        }
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

    async announce(message: string) {
        const mainGuild = await client.guilds.fetch(config.guilds.main);
        const channel = await mainGuild.channels.fetch(config.channels.news);
        if (channel && channel.isTextBased()) {
            await channel.send(message);
        }
    },

    async incarcerate(userId: string) {
        // add incarcerated state
        await util.addState(userId, "incarcerated");

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

    async removeIncarcerated(userId: string) {
        const userData = await Player.findOne({ userId });
        if (!userData) throw new Error("Player does not exist.");

        // remove incarcerated state
        await util.removeState(userId, "incarcerated");

        // remove incarcerated role and add civilian role
        const mainGuild = await client.guilds.fetch(config.guilds.main);
        const member = await mainGuild.members.fetch(userId).catch(() => null);

        if (member) {
            // remove incarcerated role
            await member.roles
                .remove(config.discordRoles.Incarcerated)
                .catch(console.error);
            // add civilian role (only if they are still alive)
            await game.addRoleIfAlive(userId, "Civilian");
        }
    },

    async kidnap(
        userId: string,
        kidnapperGuild: GuildName,
        kidnapperId?: string
    ) {
        // add kidnapped state
        await util.addState(userId, "kidnapped");
    },

    async releaseKidnap(userId: string) {
        // remove kidnapped state
        await util.removeState(userId, "kidnapped");

        // remove kidnapped role
        const mainGuild = await client.guilds.fetch(config.guilds.main);
        const member = await mainGuild.members.fetch(userId).catch(() => null);
        await member?.roles
            .remove(config.discordRoles.Kidnapped)
            .catch(console.error);

        // add civilian role (only if they are still alive)
        await game.addRoleIfAlive(userId, "Civilian");
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
        notifierMessage += `\nAs a result, anything you send in shared channels will be viewable by ${viewableBy}.
    \nA shared channel is any channel which is not solely visible to you at all times.`;

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
