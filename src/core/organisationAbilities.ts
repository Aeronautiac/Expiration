import { Client, Message, TextChannel } from "discord.js";
import { OrganisationAbilityName } from "../configs/organisationAbilities";
import { OrganisationName } from "../configs/organisations";
import {
    OrganisationAbilityArgs,
    SharedAbilityArgs,
} from "../configs/abilityArgs";
import Player from "../models/player";
import { failure, success } from "../types/Result";
import { config } from "../configs/config";
import names from "./names";
import Organisation from "../models/organisation";
import game from "./game";
import Season from "../models/season";
import Lounge from "../models/lounge";
import util from "./util";
import sharedAbilities from "./sharedAbilities";
import death from "./death";
import orgs from "./orgs";
import kill from "../commands/hostCommands/kill";
import { guilds } from "../configs/guilds";
import access from "./access";

async function canDoLeaderAction(userId: string, orgName: OrganisationName) {
    // is the person using the command allowed to do a task force invite?
    const orgData = await Organisation.findOne({ name: orgName });
    if (orgData.leaderId !== userId)
        return failure(
            `You are not the ${
                config.organisations[orgName].rankNames["leader"] ?? "leader"
            } of ${util.articledOrgMention(orgName, null)}`
        );
    if (!orgData.memberIds.includes(userId))
        return failure(
            `You are not a ${
                config.organisations[orgName].rankNames.member
            } of the ${util.articledOrgMention(orgName, null)}.`
        );
    const userData = await Player.findOne({ userId });
    if (!userData) return failure("You are not a player.");
    if (!userData.flags.get("alive")) return failure("You are dead.");

    return success();
}

export const memberAbilities: Set<OrganisationAbilityName> = new Set();
memberAbilities.add("Public Kidnap");
memberAbilities.add("Shinigami Sacrifice");

export const targetAbilities: Set<OrganisationAbilityName> = new Set();
targetAbilities
    .add("2nd Kira+Kira Anonymous Kidnap")
    .add("Anonymous Kidnap")
    .add("Background Check")
    .add("Civilian Arrest")
    .add("PI+Watari Unlawful Arrest")
    .add("Public Kidnap")
    .add("Unlawful Arrest")
    .add("Shinigami Sacrifice");

export const loungeNumberAbilities: Set<OrganisationAbilityName> = new Set();
loungeNumberAbilities.add("Tap In");

async function kidnapCheck(orgName: OrganisationName, args: any) {
    const targetData = await Player.findOne({ userId: args.targetId });
    // if the target is dead or is not a player, they cannot be kidnapped
    if (!targetData) return failure("This person is not a player.");
    if (!targetData.flags.get("alive")) return failure("This person is dead.");
    // if the target is already locked up in some way, or is protected by ipp, they cannot be kidnapped
    if (
        targetData.flags.get("custody") ||
        targetData.flags.get("incarcerated") ||
        targetData.flags.get("kidnapped") ||
        targetData.flags.get("ipp")
    )
        return failure("This person cannot be kidnapped right now.");

    if (!args.kidnapperId) return success();
    // if the kidnapper is not a player, they cannot kidnap
    const kidnapperData = await Player.findOne({
        userId: args.kidnapperId,
    });
    // if the kidnapper is the person being kidnapped, should return a failure
    if (args.kidnapperId === args.targetId)
        return failure("The kidnapper cannot kidnap themselves.");
    if (!kidnapperData) return failure("The kidnapper is not a player.");
    // if they are not part of the org, they cannot be the kidnapper.
    const orgData = await Organisation.findOne({ name: orgName });
    if (!orgData.memberIds.includes(args.kidnapperId))
        return failure("The kidnapper is not part of the organization.");
    // if they have an ability restrictor, they cannot be the kidnapper.
    if (kidnapperData.abilityRestrictors.size > 0)
        return failure("This person cannot kidnap anyone right now.");

    return success();
}

let client: Client;

const orgAbilities = {
    init(c: Client) {
        client = c;
    },

    "Background Check": async (
        orgName: OrganisationName,
        args: OrganisationAbilityArgs["Background Check"],
        checkOnly?: boolean
    ) => {
        const targetData = await Player.findOne({ userId: args.targetId });
        if (!targetData) return failure("This person is not a player.");
        if (!targetData.flags.get("alive"))
            return failure("This person is dead.");

        if (checkOnly) return success();

        const mainChannel = (await client.channels.fetch(
            config.channels[config.organisations[orgName].mainChannel]
        )) as TextChannel;
        const nameRevealMessage = await mainChannel.send(
            `The true name of **${await names.getAlias(
                args.targetId
            )}** is **${names.toReadable(targetData.trueName)}**.`
        );
        await nameRevealMessage.pin();

        return success();
    },

    "Public Kidnap": async (
        orgName: OrganisationName,
        args: OrganisationAbilityArgs["Public Kidnap"],
        checkOnly?: boolean
    ) => {
        const kidnapCheckResult = await kidnapCheck(orgName, args);
        if (!kidnapCheckResult.success) return kidnapCheckResult;

        if (checkOnly) return success();

        const orgConfig = config.organisations[orgName];
        await game.kidnap(args.targetId, config.guilds[orgConfig.guild], {
            kidnapperId: args.kidnapperId,
            duration: config.organisationAbilities["Public Kidnap"].duration,
            announce: true,
            kidnapperOrg: orgName,
        });

        return success();
    },

    "Anonymous Kidnap": async (
        orgName: OrganisationName,
        args: OrganisationAbilityArgs["Anonymous Kidnap"],
        checkOnly?: boolean
    ) => {
        const kidnapCheckResult = await kidnapCheck(orgName, args);
        if (!kidnapCheckResult.success) return kidnapCheckResult;

        if (checkOnly) return success();

        const orgConfig = config.organisations[orgName];
        await game.kidnap(args.targetId, config.guilds[orgConfig.guild], {
            duration: config.organisationAbilities["Anonymous Kidnap"].duration,
            announce: true,
            kidnapperOrg: orgName,
        });

        return success();
    },

    "2nd Kira+Kira Anonymous Kidnap": async (
        orgName: OrganisationName,
        args: OrganisationAbilityArgs["Anonymous Kidnap"],
        checkOnly?: boolean
    ) => {
        return orgAbilities["Anonymous Kidnap"](orgName, args, checkOnly);
    },

    "Unlawful Arrest": async (
        orgName: OrganisationName,
        args: OrganisationAbilityArgs["Unlawful Arrest"],
        checkOnly?: boolean
    ) => {
        const targetData = await Player.findOne({ userId: args.targetId });
        // if the target is dead or is not a player, they cannot be arrested
        if (!targetData) return failure("This person is not a player.");
        if (!targetData.flags.get("alive"))
            return failure("This person is dead.");
        // if the target is already locked up in some way, they cannot be arrested, or is protected by ipp, they cannot be arrested
        if (
            targetData.flags.get("incarcerated") ||
            targetData.flags.get("kidnapped") ||
            targetData.flags.get("ipp")
        )
            return failure("This person cannot be arrested right now.");

        if (checkOnly) return success();

        const duration =
            config.organisationAbilities["Unlawful Arrest"].duration;
        const message = `@everyone ${util.articledOrgMention(
            orgName
        )} has performed an unlawful arrest on <@${
            args.targetId
        }>. They will now be <@&${
            config.discordRoles.Incarcerated
        }> for ${duration} hours.`;
        await game.incarcerate(args.targetId, {
            duration,
            message,
        });

        return success();
    },

    "PI+Watari Unlawful Arrest": async (
        orgName: OrganisationName,
        args: OrganisationAbilityArgs["Unlawful Arrest"],
        checkOnly?: boolean
    ) => {
        return orgAbilities["Unlawful Arrest"](orgName, args, checkOnly);
    },

    // need to finish the blackout functions in the game module first
    Blackout: async (
        orgName: OrganisationName,
        args: OrganisationAbilityArgs["Blackout"],
        checkOnly?: boolean
    ) => {
        const season = await Season.findOne({});
        if (season.flags.get("blackout"))
            return failure("A blackout is already active.");

        if (checkOnly) return success();

        await game.startBlackout(
            config.organisationAbilities.Blackout.duration
        );

        return success();
    },

    "Tap In": async (
        orgName: OrganisationName,
        args: OrganisationAbilityArgs["Tap In"],
        checkOnly?: boolean
    ) => {
        const lounge = await Lounge.findOne({ loungeId: args.loungeNumber });
        if (!lounge) return failure("This is not a valid lounge number.");

        if (checkOnly) return success();

        // get display names
        const contactorData = await Player.findOne({
            userId: lounge.contactorId,
        });
        const displayNames: { [userId: string]: string } = {
            [lounge.contactorId]: lounge.anonymous
                ? contactorData.role
                : await names.getAlias(lounge.contactorId),
            [lounge.contactedId]: await names.getAlias(lounge.contactedId),
        };

        // create tap in channel
        const logChannel = (await util.createTemporaryChannel(
            config.guilds[config.organisations[orgName].guild],
            `tap-in-${args.loungeNumber}`,
            config.categoryPrefixes.tapIn
        )) as TextChannel;

        // for anonymous lounges, we will need to get all messages from both channels and then combined them into an array,
        // then sort that array in reverse order
        const fetchPromises = lounge.channelIds.map(async (id) => {
            return await util.fetchAllMessages(
                id,
                null,
                (msg) => !msg.author.bot
            );
        });
        const allMessages = (await Promise.all(fetchPromises))
            .flat()
            .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

        let lastSpeakerId = null;
        let currentBlock = [];
        let currentBlockName = "";
        const CHUNK_LIMIT = 2000;

        // Send a block as chunks, ensuring no message is split
        async function sendBlock(blockName, blockLines) {
            if (blockLines.length === 0) return;
            let prefix = `\`\`\`${blockName}:\`\`\`\n`;
            let chunk = prefix;
            for (let i = 0; i < blockLines.length; i++) {
                let line = blockLines[i];
                // If adding this line would exceed the limit, send the chunk and start a new one (fixes timestamp being cut off and looking very bad lol)
                if (chunk.length + line.length > CHUNK_LIMIT) {
                    await logChannel.send(chunk);
                    await util.sleep(1);
                    // Start new chunk with prefix and current line
                    chunk = prefix + line;
                } else {
                    chunk += (chunk === prefix ? "" : "\n") + line;
                }
            }
            // Send any remaining chunk
            if (chunk.length > prefix.length) {
                await logChannel.send(chunk);
                await util.sleep(1);
            }
        }

        await util.sleep(1);

        for (const msg of allMessages) {
            const displayName = displayNames[msg.author.id];
            if (!displayName) continue;

            // Check for image attachments without links (if an img is sent without a link, the bot sends an empty string as a log)
            let imageLinks = [];
            if (msg.attachments && msg.attachments.size > 0) {
                msg.attachments.forEach((att) => {
                    if (
                        att.contentType &&
                        att.contentType.startsWith("image/") &&
                        att.url
                    ) {
                        imageLinks.push(att.url);
                    }
                });
            }

            let msgContent = msg.content;
            if (imageLinks.length > 0) {
                msgContent += (msgContent ? "\n" : "") + imageLinks.join("\n");
            }

            // Format line with timestamp
            const timestamp = `<t:${Math.floor(msg.createdTimestamp / 1000)}>`;
            const line = `"${msgContent}" ${timestamp}`;

            if (msg.author.id !== lastSpeakerId) {
                // Send previous block if exists
                await sendBlock(currentBlockName, currentBlock);
                // Start new block
                currentBlock = [line];
                currentBlockName = displayName;
                lastSpeakerId = msg.author.id;
            } else {
                currentBlock.push(line);
            }
        }
        // Send last block
        await sendBlock(currentBlockName, currentBlock);

        // send notif message
        const notifPromises = lounge.channelIds.map(async (id) => {
            const channel = (await client.channels.fetch(id)) as TextChannel;
            await channel.send(
                `@everyone This lounge has been tapped into by ${util.articledOrgMention(
                    orgName
                )}. All messages up to this point have been logged.`
            );
        });
        await Promise.all(notifPromises);

        return success();
    },

    "Kira's Kingdom Invite": async (
        orgName: OrganisationName,
        args: OrganisationAbilityArgs["Kira's Kingdom Invite"],
        checkOnly?: boolean
    ) => {
        const targetData = await Player.findOne({ userId: args.targetId });
        if (!targetData) return failure("This person is not a player.");
        if (!targetData.flags.get("alive"))
            return failure("This person is dead.");
        const orgData = await Organisation.findOne({ name: orgName });
        if (orgData.memberIds.includes(args.targetId))
            return failure("This is already a member of Kira's Kingdom.");

        if (checkOnly) return success();

        await orgs.addToOrg(args.targetId, orgName, {});

        return success();
    },

    "Kira's Kingdom Kick": async (
        orgName: OrganisationName,
        args: OrganisationAbilityArgs["Kira's Kingdom Kick"],
        checkOnly?: boolean
    ) => {
        const targetData = await Player.findOne({ userId: args.targetId });
        if (!targetData) return failure("This person is not a player.");
        if (!targetData.flags.get("alive"))
            return failure("This person is dead.");
        const orgData = await Organisation.findOne({ name: orgName });
        if (!orgData.memberIds.includes(args.targetId))
            return failure("This is not a member of Kira's Kingdom.");

        if (checkOnly) return success();

        await orgs.removeFromOrg(args.targetId, orgName);

        return success();
    },

    "Civilian Arrest": async (
        orgName: OrganisationName,
        args: SharedAbilityArgs["Civilian Arrest"],
        checkOnly?: boolean
    ) => {
        return sharedAbilities.civilianArrest(orgName, args, checkOnly);
    },

    "Shinigami Sacrifice": async (
        orgName: OrganisationName,
        args: OrganisationAbilityArgs["Shinigami Sacrifice"],
        checkOnly?: boolean
    ) => {
        const targetData = await Player.findOne({ userId: args.targetId });
        // if the target is dead or is not a player, they cannot be arrested
        if (!targetData) return failure("This person is not a player.");
        if (!targetData.flags.get("alive"))
            return failure("This person is dead.");
        const orgData = await Organisation.findOne({ name: orgName });
        if (!orgData.memberIds.includes(args.memberId))
            return failure("This person is not a member.");
        if (!orgData.ogMemberIds.includes(args.memberId))
            return failure("This is not an og member.");
        const memberData = await Player.findOne({ userId: args.memberId });
        if (!memberData) return failure("The chosen member is not a player.");
        if (!targetData.flags.get("alive"))
            return failure("The chosen member is already dead.");

        if (checkOnly) return success();

        // the killer should be a person who could have voted
        const killerPool = (await orgs.getVotingMembers(orgName)).filter(
            (memberId) => memberId !== args.memberId
        );
        await death.kill(args.memberId, {
            killerId: killerPool[Math.floor(Math.random() * killerPool.length)],
            deathMessage: `Their soul was sold to a shinigami by ${util.articledOrgMention(
                orgName
            )} in exchange for a true name.`,
            bypassIPP: true,
        });

        // send message
        const channel = (await client.channels.fetch(
            config.channels[config.organisations[orgName].mainChannel]
        )) as TextChannel;
        const msg: Message = await channel.send(
            `The true name of **${await names.getAlias(
                args.targetId
            )}** is **${names.toReadable(targetData.trueName)}**.`
        );
        await msg.pin();

        return success();
    },

    "Task Force Invite": async (
        orgName: OrganisationName,
        args: OrganisationAbilityArgs["Task Force Invite"],
        checkOnly?: boolean
    ) => {
        // is the person inviting allowed to do it?
        const result = await canDoLeaderAction(args.userId, orgName);
        if (!result.success) return result;

        // is the target allowed to be invited with the arguments supplied?
        if (args.targetId === args.userId)
            return failure("You cannot invite yourself.");
        const orgData = await Organisation.findOne({ name: orgName });
        const targetData = await Player.findOne({ userId: args.targetId });
        if (!targetData) return failure("This person is not a player.");
        if (!targetData.flags.get("alive"))
            return failure("This person is dead.");
        if (orgData.memberIds.includes(args.targetId))
            return failure(
                "This person is already a member of the Task Force."
            );
        if (targetData.trueName !== names.toInternal(args.trueName))
            return failure("This is not the target's true name.");

        if (checkOnly) return success();

        // send true name in task force channel
        const mainChannel = (await client.channels.fetch(
            config.channels[config.organisations[orgName].mainChannel]
        )) as TextChannel;
        const nameRevealMessage = await mainChannel.send(
            `@everyone **${await names.getAlias(
                args.targetId
            )}** has been added to the Task Force. Their true name is **${names.toReadable(
                targetData.trueName
            )}**.`
        );
        await nameRevealMessage.pin();

        await orgs.addToOrg(args.targetId, orgName, {});

        return success();
    },

    "Task Force Kick": async (
        orgName: OrganisationName,
        args: OrganisationAbilityArgs["Task Force Kick"],
        checkOnly?: boolean
    ) => {
        // is the person using the command allowed to do a task force kick?
        const result = await canDoLeaderAction(args.userId, orgName);
        if (!result.success) return result;

        // is the target allowed to be kicked with the arguments supplied?
        if (args.targetId === args.userId)
            return failure("You cannot kick yourself.");
        const targetData = await Player.findOne({ userId: args.targetId });
        if (!targetData) return failure("This person is not a player.");
        const orgData = await Organisation.findOne({ name: orgName });
        if (!orgData.memberIds.includes(args.targetId))
            return failure("This person is not a member of the Task Force.");

        if (checkOnly) return success();

        await orgs.removeFromOrg(args.targetId, orgName);

        // send notifier in task force channel
        const mainChannel = (await client.channels.fetch(
            config.channels[config.organisations[orgName].mainChannel]
        )) as TextChannel;
        await mainChannel.send(
            `@everyone **${await names.getAlias(
                args.targetId
            )}** has been kicked from the Task Force.`
        );

        return success();
    },
};

export default orgAbilities;
