import { Client, TextChannel } from "discord.js";
import death from "./death";
import agenda from "../jobs";
import util from "./util";
import { config } from "../configs/config";
import Player from "../models/player";
import { failure, success } from "../types/Result";
import names from "./names";
import { RoleName } from "../configs/roles";
import { PlayerAbilityArgs } from "../configs/abilityArgs";
import game from "./game";
import contacting from "./contacting";
import Season from "../models/season";

let client: Client;

const module = {
    init(c: Client) {
        client = c;
    },

    async pseudocide(
        userId: string,
        args: PlayerAbilityArgs["pseudocide"],
        checkOnly?: boolean
    ) {
        const targetData = await Player.findOne({ userId: args.targetId });
        if (!targetData)
            return failure("This user is not registered as a player.");
        if (!targetData.flags.get("alive"))
            return failure("This user is dead.");
        if (targetData.flags.get("ipp"))
            return failure("This user is under IPP.");

        if (checkOnly) return success();

        let affiliations = [];
        if (args.affiliationsString)
            affiliations = args.affiliationsString.split(", ");

        const target = await client.users.fetch(args.targetId);
        await target
            .send(
                "You have been pseudocided. Do not ask any players for information in the shinigami realm. If you do so, you will be punished."
            )
            .catch(() => {
                console.warn(
                    `Could not notify user ${args.targetId} of pseudocide.`
                );
            });

        // kill the target without sending a death announcement
        await death.kill(args.targetId, {
            dontSendDeathAnnouncement: true,
        });

        // announce their death with the fake message
        await death.announce(args.targetId, {
            deathMessage: args.message,
            ownedANotebook: args.hasNotebook,
            ownedBugAbility: args.hasBugAbility,
            trueName: args.trueName,
            role: args.role,
            affiliations: affiliations,
        });

        // schedule their revival for after the pseudocide period
        const reviveAt = new Date(
            Date.now() +
                util.hrsToMs(config.playerAbilities.pseudocide.duration)
        );
        await agenda.schedule(reviveAt, "pseudocideRevival", {
            userId: args.targetId,
            roleOnDeath: args.role,
        });

        return success();
    },

    async ipp(
        userId: string,
        args: PlayerAbilityArgs["ipp"],
        checkOnly?: boolean
    ) {
        const targetData = await Player.findOne({ userId: args.targetId });
        if (!targetData) return failure("This user has no data.");
        if (!targetData.flags.get("alive"))
            return failure("This user is dead.");
        if (targetData.flags.get("ipp"))
            return failure("This user is already under IPP.");

        if (checkOnly) return success();

        targetData.flags.set("ipp", true);
        await targetData.save();

        names.setNick(
            args.targetId,
            `${names.getDisplay(args.targetId)} (IPP)`
        );

        return success();
    },

    async underTheRadar(
        userId: string,
        args: PlayerAbilityArgs["underTheRadar"],
        checkOnly?: boolean
    ) {
        if (checkOnly) return success();
        await Player.findOneAndUpdate(
            { userId },
            { $set: { "flags.underTheRadar": true } }
        );
        return success();
    },

    async bug(
        userId: string,
        args: PlayerAbilityArgs["bug"],
        checkOnly?: boolean
    ) {
        const targetData = await Player.findOne({ userId: args.targetId });
        if (!targetData) return failure("This user has no data.");
        if (!targetData.flags.get("alive"))
            return failure("This user is dead.");

        if (checkOnly) return success();

        await game.bug(args.targetId, "bug", userId);

        return success();
    },

    async anonymousAnnouncement(
        userId: string,
        args: PlayerAbilityArgs["anonymousAnnouncement"],
        checkOnly?: boolean
    ) {
        if (checkOnly) return success();
        await game.announce(`@everyone **???:** ${args.message}`);
        return success();
    },

    async anonymousContact(
        userId: string,
        args: PlayerAbilityArgs["anonymousContact"],
        checkOnly?: boolean
    ) {
        if (checkOnly) return success();
        return await contacting.contact(userId, args.targetId, true);
    },

    async autopsy(
        userId: string,
        args: PlayerAbilityArgs["autopsy"],
        checkOnly?: boolean
    ) {
        const season = await Season.findOne({});
        const targetId = args.targetId;
        const targetData = await Player.findOne({ userId: targetId });

        if (!targetData) return "This user has no data.";
        if (targetData.flags.get("alive")) return "This user is not dead.";

        const timeOfDeath = targetData.timeOfDeath;
        const autopsyLogs = (await client.channels.fetch(
            config.channels.autopsyLogs
        )) as TextChannel;

        // fetch all messages after and including earliest
        const earliest = timeOfDeath - util.hrsToMs(3);
        const allMessagesArrays = await Promise.all(
            season.messageLoggedChannels.map(async (channelId) => {
                const channel = await client.channels
                    .fetch(channelId)
                    .catch(() => null);
                if (!channel) return [];
                return util.fetchAllMessages(
                    channel,
                    earliest,
                    (msg) => msg.author.id === targetId
                );
            })
        );

        // sort in ascending order based on timestamp
        const allMessages = allMessagesArrays
            .flat()
            .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

        let currentBlock = [];
        const CHUNK_LIMIT = 2000;

        // send autopsy notifier
        const beginMessage = await autopsyLogs.send({
            content: `Autopsy logs for <@${targetId}>:`,
        });
        await beginMessage.pin().catch(console.error);
        await autopsyLogs.send({
            content:
                "==========================<START OF AUTOPSY>==========================",
        });

        await new Promise((res) => setTimeout(res, 5000));

        // Send a block as chunks, ensuring no message is split
        async function sendBlock(blockLines: string[]) {
            console.log(blockLines);
            if (blockLines.length === 0) return;
            let chunk = "";
            for (let i = 0; i < blockLines.length; i++) {
                let line = blockLines[i];
                // If adding this line would exceed the limit, send the chunk and start a new one (fixes timestamp being cut off and looking very bad lol)
                if (chunk.length + line.length > CHUNK_LIMIT) {
                    await autopsyLogs.send({ content: chunk });
                    await new Promise((res) => setTimeout(res, 5000));
                    // Start new chunk with prefix and current line
                    chunk = line;
                } else {
                    chunk += "\n" + line;
                }
            }

            if (chunk.length > 0) {
                await autopsyLogs.send({ content: chunk });
                await new Promise((res) => setTimeout(res, 5000));
            }
        }
        // send all messages in autopsy logs
        for (const msg of allMessages) {
            // Format line with timestamp
            const timestamp = `<t:${Math.floor(msg.createdTimestamp / 1000)}>`;

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

            const line = `[${timestamp}] "${msgContent}"`;

            // Send previous block if exists
            currentBlock.push(line);
        }
        // Send last block
        await sendBlock(currentBlock);

        await autopsyLogs.send({
            content:
                "==========================<END OF AUTOPSY>==========================",
        });
    },
};

export default module;
