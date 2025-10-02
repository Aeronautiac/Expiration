import {
    Client,
    GuildMember,
    Message,
    PermissionOverwriteOptions,
    Role,
    TextChannel,
    User,
} from "discord.js";
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
import { channels } from "../configs/channels";
import { discordRoles } from "../configs/discordRoles";
import Organisation from "../models/organisation";
import Ability from "../models/ability";
import death from "./death";
import { guilds } from "../configs/guilds";

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
        let playerData = await Player.findOne({ "userId": userId });

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

            await util.sendToUser(userId, `Your true name is **${names.toReadable(name)}**`);
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

    async initializeLoggableChannels() {
        const setLoggablePromises = config.loggableChannels.map(
            async (name) => {
                await util.setChannelLoggable(config.channels[name], true);
            }
        );
        await Promise.all(setLoggablePromises);
    },

    async newSeason() {
        const existingSeason = await Season.findOne({});
        if (existingSeason) return failure("A season already exists.");

        await Season.create({});
        await orgs.createDefaults();
        await game.initializeLoggableChannels();

        return success(
            "Successfully created a new season. Run /startseason to begin."
        );
    },

    async startSeason() {
        const season = await Season.findOne({});
        if (!season)
            return failure("No season exists. Create one with /newseason.");

        await Season.updateOne({}, { "flags.active": true });

        await game.announceDayNumber();

        for (const guildId of Object.values(guilds)) {
            if (guildId === config.guilds.main) continue;
            const guild = await client.guilds.fetch(guildId).catch(() => null);
            if (!guild) continue;
            const loungeChannel = guild.channels.cache.find(
                channel => channel.type === 0 && channel.name === "lounge"
            );
            if (loungeChannel) {
                await loungeChannel.permissionOverwrites.edit(
                    loungeChannel.guild.roles.everyone,
                    { SendMessages: false }
                );
            }
        }

        return success("Season started. Run /endseason to end.");
    },

    async endSeason(announce: boolean) {
        const season = await Season.findOne({});
        if (!season)
            return failure("No season exists. Create one with /newseason.");

        await Season.updateOne({}, { "flags.active": false });

        agenda.cancel({}); // cancel all delayed actions

        if (announce) {
            await game
                .announce(
                    `@everyone The season has now ended. Thank you all for participating! Roles will be revealed and spectator will be given out shortly.`
                )
                .catch(console.error);

            await util.sleep(config.announcementDelay * 2);

            const roleRevealMessage = await util.produceListOfRoles(true);
            await game.announce(roleRevealMessage).catch(console.error);

            await util.sleep(config.announcementDelay);

            await game
                .announce(
                    `Invites to role servers as well as spectator roles will now be given out.`
                )
                .catch(console.error);

            await util.sleep(config.announcementDelay * 2);

            for (const playerData of await Player.find({})) {
                await game.makeSpectator(playerData.userId);
            }

            for (const guildId of Object.values(guilds)) {
                if (guildId === config.guilds.main) continue;
                const guild = await client.guilds.fetch(guildId).catch(() => null);
                if (!guild) continue;
                const loungeChannel = guild.channels.cache.find(
                    channel => channel.type === 0 && channel.name === "lounge"
                );
                if (loungeChannel) {
                    await loungeChannel.send(config.postGameDiscussionMessage).catch(console.error);
                    await loungeChannel.permissionOverwrites.edit(
                        loungeChannel.guild.roles.everyone,
                        { SendMessages: true }
                    );
                }
            }
        }

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

    async makeSpectator(userId: string): Promise<boolean> {
        const mainGuild = await client.guilds.fetch(config.guilds.main);
        const member: GuildMember = await mainGuild.members.fetch(userId).catch(() => null);
        if (!member) return false;

        const adminRoleIds = (await mainGuild.roles.fetch())
            .filter(role => role.permissions.has("Administrator"))
            .map(role => role.id);

        const rolesToRemove = member.roles.cache
            .filter(role => !adminRoleIds.includes(role.id))
            .map(role => role);

        await Promise.all(
            rolesToRemove
                .filter(role => mainGuild.roles.cache.has(role.id))
                .map(role => member.roles.remove(role).catch(console.error))
        );

        await member.roles.add(discordRoles.Shinigami).catch(console.error);
        await member.roles.add(discordRoles.Spectator).catch(console.error);

        // invite to all guilds
        await access.grantAll(userId);

        const playerData = await Player.findOne({ userId });
        if (playerData) {
            playerData.flags.set("spectator", true);
            await playerData.save();
        }
        return true;
    },

    async createMonologue(userId: string): Promise<TextChannel> {
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

        return monologueChannel as TextChannel;
    },

    async resetContactTokens() {
        await Player.updateMany(
            {},
            { contactTokens: config.dailyContactTokens }
        );
    },

    // just set flag and make news and courtroom unviewable. all else is manually handled.
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
        await util.addPermissionsToChannel(config.channels.anonymousCourtroom, [
            settings,
        ]);

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
        await util.addPermissionsToChannel(config.channels.anonymousCourtroom, [
            settings,
        ]);

        await Season.updateOne(
            {},
            {
                $set: { "flags.blackout": false },
            }
        );

        // if agenda job exists, cancel
        await agenda.cancel({ name: "endBlackout" });
    },

    async announceDayNumber() {
        // announce day change
        const season = await Season.findOne({});
        await game.announce(
            `@everyone Day **${season.day}/${config.seasonDuration}**`
        );
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
        await game.announceDayNumber();
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

    async silentProsecute(
        prosecutorId: string,
        asOrg: OrganisationName,
        targetId: string
    ): Promise<Result> {
        const season = await Season.findOne({});
        if (!season) return failure("No season currently exists");
        if (!season.flags.get("active"))
            return failure("The season is not currently active.");

        const userData = await Player.findOne({ userId: prosecutorId });
        const targetData = await Player.findOne({ userId: targetId });

        const orgData = await Organisation.findOne({ name: asOrg });
        if (prosecutorId === targetId)
            return failure("You cannot prosecute yourself.");
        if (!orgData) return failure("This organisation has no data.");
        if (!orgData.memberIds.includes(prosecutorId))
            return failure("You are not a member of this organisation.");
        if (!userData) return failure("You are not a player.");
        if (!userData.flags.get("alive")) return failure("You are dead.");
        if (!targetData) return failure("The target is not a player.");
        if (!targetData.flags.get("alive"))
            return failure("The target is not alive.");
        if (targetData.flags.get("ipp"))
            return failure(
                "A silent prosecution cannot be performed on a target who is under IPP."
            );

        let fail: boolean = false;

        // get all prosecutable orgs (atp orgs that have used blackout)
        const blackoutAbilities = await Ability.find({
            ability: "Blackout",
            $or: [{ cooldown: { $gt: 0 } }, { queuedCooldown: { $gt: 0 } }],
        });
        const orgSet = new Set(Object.keys(organisations));
        const orgsProsecutable = new Set(
            blackoutAbilities.map((a) => a.owner).filter((a) => orgSet.has(a))
        );

        // check if the player is a member of any of those orgs
        const targetMemberObjects = await util.getMemberObjects(targetId);
        const memberOfProsecutableOrgs = targetMemberObjects
            .filter((memberObj) => orgsProsecutable.has(memberObj.org))
            .map((orgMember) => orgMember.org);

        // if the target is not a member of an org that can currently be prosecuted, or they have not performed a public kidnapping and been revealed,
        // then the prosecution was a failure
        fail = !(
            memberOfProsecutableOrgs.length > 0 ||
            targetData.flags.get("didPublicKidnap")
        );

        if (fail) {
            // reveal prosecutor
            game.announce(
                `@everyone a ${config.organisations[asOrg].rankNames.member
                } of ${util.articledOrgMention(
                    asOrg
                )}, <@${prosecutorId}> (${names.toReadable(
                    userData.trueName
                )}) has attempted to carry out a silent prosecution against someone they suspected of being involved in acts of terrorism.\nAfter further investigation, it was determined that this person was **not guilty**.\nDespite this, <@${prosecutorId}> persisted with their efforts.\nAs a result, they have been **permanently banned** from ${util.articledOrgMention(
                    asOrg
                )}.`
            ).catch(console.error);

            // kick and blacklist from the org they used the ability in
            orgs.removeFromOrg(prosecutorId, asOrg, true).catch(console.error);

            return success();
        }

        // kill target
        game.announce(
            `@everyone ${util.articledOrgMention(
                asOrg
            )} has carried out a silent prosecution against <@${targetId}>. They have been found guilty of being involved in acts of terrorism.`
        ).catch(console.error);
        death
            .kill(targetId, {
                killerId: prosecutorId,
                deathMessage: "They were executed on the spot.",
            })
            .catch(console.error);

        return success();
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
            `${await names.getAlias(userId)}-${anonymous ? "anonymous" : "public"
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
            `${await names.getAlias(userId)}-${anonymous ? "anonymous" : "public"
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
            if (args.kidnapperOrg)
                announceMessage += ` by ${util.articledOrgMention(
                    args.kidnapperOrg
                )}`;
            announceMessage += `. Authorities have begun rescue efforts, but it may be a while before they succeed.`;
            await game.announce(announceMessage);
        }

        // handle roles
        const member = await mainGuild.members.fetch(userId).catch(() => null);
        await member?.roles
            .add(config.discordRoles.Kidnapped)
            .catch(console.error);
        await member?.roles
            .remove(config.discordRoles.Civilian)
            .catch(console.error);
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
        // and set the performed public kidnapping flag of the kidnapper to true
        if (!userData.flags.get("alive")) return;
        const releaseMessage = await game.announce(
            `@everyone <@${userId}> has been rescued by authorities.`
        );
        await util.sleep(config.announcementDelay);
        if (kidnapData.kidnapperId) {
            await releaseMessage.reply(
                `When questioned, they identified their kidnapper as <@${kidnapperId}>.`
            );
            // update kidnapper data
            await Player.updateOne(
                { userId: kidnapperId },
                { "flags.didPublicKidnap": true }
            );
        } else
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

    async newTrueName(userId: string, trueName?: string) {
        const newTrueName = trueName ? trueName : await names.getUnique();
        await Player.updateOne(
            { userId },
            {
                trueName: names.toInternal(newTrueName),
            }
        );
        const user: User = await client.users.fetch(userId).catch(() => null);
        if (user)
            await util.sendToUser(userId, `Your new true name is **${names.toReadable(newTrueName)}**.`);
        // await user.send(
        //     `Your new true name is **${names.toReadable(newTrueName)}**.`
        // );
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
        notifierMessage += `\nA shared channel is any channel which is not solely visible to you at all times. (This does not include death notes)`;

        try {
            await util.sendToUser(target.id, notifierMessage);
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
