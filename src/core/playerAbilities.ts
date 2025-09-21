import { Attachment, Client, TextChannel } from "discord.js";
import death from "./death";
import agenda from "../jobs";
import util from "./util";
import { config } from "../configs/config";
import Player from "../models/player";
import { failure, success } from "../types/Result";
import names from "./names";
import { PlayerAbilityArgs } from "../configs/abilityArgs";
import game from "./game";
import contacting from "./contacting";
import Season from "../models/season";
import Notebook from "../models/notebook";
import { guilds } from "../configs/guilds";
import sharedAbilities from "./sharedAbilities";

let client: Client;

const playerAbilities = {
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
            memberObjects: args.memberObjects,
        });

        // schedule their revival for after the pseudocide period
        const reviveAt = new Date(
            Date.now() +
                util.hrsToMs(config.playerAbilities.pseudocide.duration)
        );
        await agenda.schedule(reviveAt, "pseudocideRevival", {
            userId: args.targetId,
            roleOnDeath: targetData.role,
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
            `${await names.getDisplay(args.targetId)} (IPP)`
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

    async nameReveal(
        userId: string,
        args: PlayerAbilityArgs["nameReveal"],
        checkOnly?: boolean
    ) {
        const userData = await Player.findOne({ userId });
        const targetData = await Player.findOne({ userId: args.targetId });
        if (!targetData) return failure("This player has no data.");
        if (!targetData.flags.get("alive"))
            return failure("This player is dead.");
        if (userData.role === "Beyond Birthday" && userData.eyes <= 0)
            return failure("You no longer possess shinigami eyes.");

        if (checkOnly) return success();

        const user = await client.users.fetch(userId);
        await user.send(
            `The true name of **${await names.getDisplay(
                args.targetId
            )}** is **${names.toReadable(targetData.trueName)}**.`
        );

        return success();
    },

    async notebookReveal(
        userId: string,
        args: PlayerAbilityArgs["notebookReveal"],
        checkOnly?: boolean
    ) {
        const targetData = await Player.findOne({ userId: args.targetId });
        const userData = await Player.findOne({ userId });

        if (!targetData) return failure("This player has no data.");
        if (!targetData.flags.get("alive"))
            return failure("This player is dead.");
        if (userData.role === "Beyond Birthday" && userData.eyes <= 0)
            return failure("You no longer possess shinigami eyes.");

        if (checkOnly) return success();

        // need to check if the target is currently holding a notebook. for all notebooks which they are the currentOwner of,
        // check if there is a temporary owner. if there is a temporary owner, they do not hold that notebook.
        // also, if the target is the temporary owner of any notebook, then they currently hold a notebook.
        const temporaryOwner = await Notebook.findOne({
            temporaryOwner: args.targetId,
        });

        let notebooksNotPassed = 0;
        const notebooksOwned = await Notebook.find({
            currentOwner: args.targetId,
        });
        for (const notebook of notebooksOwned) {
            // if temporary owner, target does not hold this notebook
            if (notebook.temporaryOwner) {
                continue;
            }
            // else, they do hold the notebook
            notebooksNotPassed++;
        }

        const user = await client.users.fetch(userId);
        if (temporaryOwner || notebooksNotPassed > 0) {
            await user.send(
                `**${await names.getAlias(
                    targetData.userId
                )}** currently possesses a notebook.`
            );
        } else {
            if (userData.role === "Beyond Birthday")
                await Player.updateOne(
                    { userId: user.id },
                    { $inc: { eyes: -1 } }
                );
            await user.send(
                `**${await names.getAlias(
                    targetData.userId
                )}** does not currently possess a notebook.`
            );
        }

        return success();
    },

    // currently hardcoded to PI, but eventually, this should work for all roles. need to remove the option for multiple guilds for roles or just add
    // a main guild option to roles. (This one is better)
    async autopsy(
        userId: string,
        args: PlayerAbilityArgs["autopsy"],
        checkOnly?: boolean
    ) {
        const season = await Season.findOne({});
        const targetId = args.targetId;
        const targetData = await Player.findOne({ userId: targetId });
        const piDiscord = await client.guilds.fetch(config.guilds.pi);

        if (!targetData) return failure("This user has no data.");
        if (targetData.flags.get("alive"))
            return failure("This user is not dead.");

        if (checkOnly) return success();

        const timeOfDeath = targetData.timeOfDeath;

        // fetch all messages after and including earliest
        const earliest = timeOfDeath - util.hrsToMs(3);
        const allMessagesArrays = await Promise.all(
            season.messageLoggedChannels.map(async (channelId) => {
                return util.fetchAllMessages(
                    channelId,
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

        // create autopsy channel
        const autopsyLogs = (await util.createTemporaryChannel(
            guilds.pi,
            `autopsy-${await names.getAlias(targetId)}`,
            config.categoryPrefixes.autopsy,
            [
                {
                    ids: [piDiscord.roles.everyone.id],
                    perms: config.logChannelPermissions,
                },
            ]
        )) as TextChannel;

        // Send a block as chunks, ensuring no message is split
        async function sendBlock(blockLines: string[]) {
            if (blockLines.length === 0) return;
            let chunk = "";
            for (let i = 0; i < blockLines.length; i++) {
                let line = blockLines[i];
                // If adding this line would exceed the limit, send the chunk and start a new one (fixes timestamp being cut off and looking very bad lol)
                if (chunk.length + line.length > CHUNK_LIMIT) {
                    await autopsyLogs.send({ content: chunk });
                    await util.sleep(5);
                    // Start new chunk with prefix and current line
                    chunk = line;
                } else {
                    chunk += "\n" + line;
                }
            }

            if (chunk.length > 0) {
                await autopsyLogs.send({ content: chunk });
                await util.sleep(5);
            }
        }
        // send all messages in autopsy logs
        for (const msg of allMessages) {
            // Format line with timestamp
            const timestamp = `<t:${Math.floor(msg.createdTimestamp / 1000)}>`;

            // Check for image attachments without links (if an img is sent without a link, the bot sends an empty string as a log)
            let imageLinks = [];
            if (msg.attachments && msg.attachments.size > 0) {
                msg.attachments.forEach((att: Attachment) => {
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

        return success();
    },

    "Civilian Arrest": async (
        userId: string,
        args: PlayerAbilityArgs["autopsy"],
        checkOnly?: boolean
    ) => {
        return sharedAbilities.civilianArrest(userId, args, checkOnly);
    },

    async trueNameReroll(
        userId: string,
        args: PlayerAbilityArgs["notebookReveal"],
        checkOnly?: boolean
    ) {
        const targetData = await Player.findOne({ userId: args.targetId });
        if (!targetData) return failure("This is not a valid player.");
        if (!targetData.flags.get("alive"))
            return failure("This user is dead.");

        if (checkOnly) return success();

        await game.newTrueName(args.targetId);

        return success();
    },
};

export default playerAbilities;
