import { Client, GuildOnboarding } from "discord.js";
import { failure, success } from "../types/Result";
import { SharedAbilityArgs } from "../configs/abilityArgs";
import Player from "../models/player";
import { config } from "../configs/config";
import polls from "./polls";
import util from "./util";
import { OrganisationName } from "../configs/organisations";
import Season from "../models/season";
import Poll from "../models/poll";
import game from "./game";
import Lounge from "../models/lounge";
import { TextChannel } from "discord.js";
import names from "./names";
import Organisation from "../models/organisation";
import { playerAbilities } from "../configs/playerAbilities";
import { IAbility } from "../models/ability";

let client: Client;

const sharedAbilities = {
    init(c: Client) {
        client = c;
    },

    async civilianArrestCheck(
        owner: string,
        args: SharedAbilityArgs["Civilian Arrest"]
    ) {
        const season = await Season.findOne({});
        if (season.flags.get("blackout"))
            return failure("Cannot civilian arrest during a blackout.");
        const targetData = await Player.findOne({ userId: args.targetId });
        if (!targetData) return failure("The target is not a valid player.");
        if (!targetData.flags.get("alive"))
            return failure("The target is dead.");
        if (
            targetData.flags.get("incarcerated") ||
            targetData.flags.get("ipp") ||
            targetData.flags.get("kidnapped")
        )
            return failure("Cannot civilian arrest this person at the moment.");

        return success();
    },

    async civilianArrest(
        abilityData: IAbility,
        owner: string,
        args: SharedAbilityArgs["Civilian Arrest"],
        checkOnly?: boolean
    ) {
        const checkResult = await sharedAbilities.civilianArrestCheck(
            owner,
            args
        );
        if (!checkResult.success) return checkResult;

        if (checkOnly) return success();

        // message stuff
        const playerData = await Player.findOne({ userId: owner });
        const arresterDisplay = playerData
            ? util.roleMention(playerData.role)
            : util.orgMention(owner as OrganisationName);
        let message = `@everyone the ${arresterDisplay} has started a civilian arrest on <@${args.targetId}>.`;
        message += `\nPlease vote whether or not you wish for this person to be arrested or not. They will be <@&${config.discordRoles.Incarcerated}> for ${config.civArrestDuration} hours if the vote is successful.`;
        message += `\nThe vote will be open for ${config.civArrestVoteDuration} hours unless something is to happen which would render the ability unusable.`;

        // create poll
        await polls.create(
            {
                messageContent: message,
                channelId: config.channels.news,
            },
            "civilianArrest",
            {
                resolve: "civArrest",
                threshold: "civMajority",
                filter: "validCivVoter",
                canContinue: "civArrest",
            },
            {
                targetId: args.targetId,
                arrester: owner,
            },
            {
                resolveAt:
                    Date.now() + util.hrsToMs(config.civArrestVoteDuration),
                prioritizeInconclusive: false,
                resolvesOnThreshold: false,
            }
        );

        return success();
    },

    async cancelCivArrest(
        abilityData: IAbility,
        owner: string,
        args: SharedAbilityArgs["Civilian Arrest"],
        checkOnly?: boolean
    ) {
        const poll = await Poll.findOne({
            data: {
                targetId: args.targetId,
                arrester: owner,
            },
        });
        if (!poll)
            return failure(
                "No civilian arrest is currently active for this user."
            );

        if (checkOnly) return success();

        // message stuff
        const playerData = await Player.findOne({ userId: owner });
        const arresterDisplay = playerData
            ? util.roleMention(playerData.role)
            : util.orgMention(owner as OrganisationName);
        let message = `@everyone the ${arresterDisplay} has cancelled the civilian arrest on <@${args.targetId}>.`;
        await game.announce(message);
        await polls.resolve(poll, "cancelled");

        return success();
    },

    "Tap In": async (
        abilityData: IAbility,
        owner: string,
        args: SharedAbilityArgs["Tap In"],
        checkOnly?: boolean
    ) => {
        const lounge = await Lounge.findOne({ loungeId: args.loungeNumber });
        if (!lounge) return failure("This is not a valid lounge number.");

        if (checkOnly) return success();

        // get display names
        const displayNames: { [userId: string]: string } = {
            [lounge.contactorId]: lounge.anonymousAsRole
                ? lounge.anonymousAsRole
                : await names.getAlias(lounge.contactorId),
            [lounge.contactedId]: await names.getAlias(lounge.contactedId),
        };

        // create tap in channel
        const org = await Organisation.findOne({ name: owner });
        const playerData = await Player.findOne({ userId: owner });
        const guildName = org
            ? config.organisations[owner].guild
            : playerData.role;
        const logChannel = (await util.createTemporaryChannel(
            config.guilds[guildName],
            `tap-in-${args.loungeNumber}`,
            config.categoryPrefixes.tapIn
        )) as TextChannel;

        // for anonymous lounges, we will need to get all messages from both channels and then combine them into an array,
        // then sort that array in reverse order
        // if this is a player, then filter out based on player tap in ability duration
        const earliestTimeStamp = org
            ? null
            : Date.now() - util.hrsToMs(playerAbilities["Tap In"].duration);
        const fetchPromises = lounge.channelIds.map(async (id) => {
            return await util.fetchAllMessages(
                id,
                earliestTimeStamp,
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
            let senderId: string;
            if (lounge.fake) {
                senderId =
                    msg.channelId === lounge.contactorChannelId
                        ? lounge.contactorId
                        : lounge.contactedId;
            } else senderId = msg.author.id;

            const displayName = displayNames[senderId];
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
        const tapInDisplay = org
            ? util.articledOrgMention(owner as OrganisationName)
            : util.roleMention(playerData.role);
        const logDisplay = org
            ? "All messages up to this point have been logged."
            : `All messages up to ${config.playerAbilities["Tap In"].duration} hours ago have been logged.`;
        const notifPromises = lounge.channelIds.map(async (id) => {
            const channel = (await client.channels.fetch(id)) as TextChannel;
            await channel.send(
                `@everyone This lounge has been tapped into by ${tapInDisplay}. ${logDisplay}`
            );
        });
        await Promise.all(notifPromises);

        // also need to reveal tap in identity to con artist if the lounge is fake
        

        return success();
    },
};

export default sharedAbilities;
