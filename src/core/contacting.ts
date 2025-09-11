import { Channel, Client } from "discord.js";
import Player from "../models/player";
import access from "./access";
import { config } from "../configs/config";
import { failure, Result, success } from "../types/Result";
import Lounge from "../models/lounge";
import util from "./util";
import GroupChat from "../models/groupChat";
import names from "./names";
import contact from "../commands/playerCommands/contact";

let client: Client;

const contacting = {

    init: function (newClient: Client) {
        client = newClient;
    },

    // adds a reason to the player's lounge hider list. If this is the first reason, the player is hidden from all lounges and their group access is revoked.
    async addLoungeHider(userId: string, reason: string): Promise<void> {
        const playerData = await Player.findOne({ userId });
        if (!playerData) return;

        const oldSize = playerData.loungeHiders.size;

        playerData.loungeHiders.set(reason, true);
        await playerData.save();

        if (oldSize > 0) return;

        // hide lounges if we went from having no blockers to having at least one
        const promises = playerData.loungeChannelIds.map(async (channelId) => {
            try {
                const lounge = await client.channels.fetch(channelId);
                if (!lounge?.isTextBased()) return;
                if (!("permissionOverwrites" in lounge)) return;

                await lounge.permissionOverwrites.delete(userId);
            } catch (err) {
                console.log("Failed to remove channel perms:", err);
            }
        });
        await Promise.all(promises);
        await access.revokeGroup(userId);
    },

    // removes a reason from the player's lounge hider list. If this was the last reason, the player is shown in all lounges again and their group access is granted.
    async removeLoungeHider(userId: string, reason: string): Promise<void> {
        const playerData = await Player.findOne({ userId });
        if (!playerData) return;

        playerData.loungeHiders.delete(reason);
        await playerData.save();

        if (playerData.loungeHiders.size > 0) return;

        // if the new size is 0, then show lounges again
        const promises = playerData.loungeChannelIds.map(async (channelId) => {
            try {
                const lounge = await client.channels.fetch(channelId);
                if (!lounge?.isTextBased()) return;
                if (!("permissionOverwrites" in lounge)) return;
                await lounge.permissionOverwrites.edit(userId, config.loungeMemberPermissions);
            } catch (err) {
                console.log("Failed to add channel perms:", err);
            }
        });
        await Promise.all(promises);
        await access.grantGroup(userId);
    },

    async contact(userId: string, targetId: string, anonymous?: boolean): Promise<Result> {
        const userData = await Player.findOne({ userId });
        const targetData = await Player.findOne({ userId: targetId });

        // if the player cannot contact, return a failure
        const canContactResult = await contacting.canContact(userId);
        if (!canContactResult.success) return canContactResult;

        // if the target cannot contact, return a failure
        const targetCanContactResult = await contacting.canContact(targetId);
        if (!targetCanContactResult.success) return targetCanContactResult;

        // if the player is also the target, return a failure
        if (userId == targetId && !anonymous) return failure("You cannot contact yourself if it is not anonymous.");

        // if the player is out of contact tokens, return a failure
        if (!userData.contactTokens) return failure("You are out of contact tokens.");

        // the contact was permitted, continue with contact logic
        // create the lounge
        const loungeId = (await Lounge.countDocuments({})) + 1;
        const channelName = `lounge-${loungeId}`;

        // create channels
        const channels: Channel[] = [];
        const contactorChannel = await util.createTemporaryChannel(config.guilds.main, channelName, config.categoryPrefixes.lounge,
            [{ ids: [userId], perms: config.loungeMemberPermissions }, { ids: [config.discordRoles.Spectator], perms: config.spectatorPermissions }]);
        channels.push(contactorChannel);

        if (anonymous) {
            const contactedChannel = await util.createTemporaryChannel(config.guilds.main, channelName, config.categoryPrefixes.lounge,
                [{ ids: [targetId], perms: config.loungeMemberPermissions }, { ids: [config.discordRoles.Spectator], perms: config.spectatorPermissions }]);
            channels.push(contactedChannel);
            // if it's anonymous, then both players have a different channel for this lounge
            targetData.loungeChannelIds.push(contactedChannel.id);
            userData.loungeChannelIds.push(contactorChannel.id);
        } else {
            // if it's a normal lounge, then they both have the same channel
            targetData.loungeChannelIds.push(contactorChannel.id);
            userData.loungeChannelIds.push(contactorChannel.id);
        }

        // subtract tokens from the user and save all changes up to this point
        userData.contactTokens = Math.max(0, userData.contactTokens - 1);
        await targetData.save();
        await userData.save();

        const contactorStr = anonymous ? util.roleMention(userData.role) : `<@${userId}>`;
        const contactedStr = `<@${targetId}>`;
        const sendPromises = channels.map(async (channel) => {
            if (channel.isSendable())
                await channel.send(`${contactorStr} ${contactedStr}`);
        });
        await Promise.allSettled(sendPromises);

        const channelIds = channels.map((channel: Channel) => channel.id);
        await Lounge.create({
            anonymous,
            channelIds,
            contactorId: userId,
            contactedId: userId,
            loungeId
        });

        // log contact
        await contacting.logContact(userId, targetId, anonymous);

        return success(`Successfully created lounge channel: ${contactorChannel}`);
    },

    async canDoGroupchatAction(userId: string, groupchatId: string): Promise<Result> {
        // if the player cannot contact, return a failure
        const canContactResult = await contacting.canContact(userId);
        if (!canContactResult.success) return canContactResult;

        // if the channel is not a group chat, return a failure
        const groupchat = await GroupChat.findOne({ channelId: groupchatId });
        if (!groupchat) return failure("This channel is not a group chat.");

        // if the player is not the owner of the group chat, return a failure
        if (groupchat.ownerId !== userId) return failure("You are not the owner of this group chat.");

        return success();
    },

    async canContact(userId: string) {
        // if the player is dead or is not a player, return a failure
        const playerData = await Player.findOne({ userId });
        if (!playerData) return failure("You are not a player.");
        if (!playerData.flags.get("alive")) return failure("You are dead.");

        // if the player has any lounge restrictors, return a failure
        if (playerData.loungeHiders.size > 0)
            return failure(`You cannot do this action right now. Reasons: ${Array.from(playerData.loungeHiders.keys()).join(`, `)}`);

        return success();
    },

    async createGroupchat(userId: string, originalMembers: string[]): Promise<Result> {
        // if too many groupchats already exist, return a failure
        const count = await GroupChat.countDocuments({});
        if (count >= config.maxGroupChatsInGame) return failure("The maximum number of groupchats already exist.");

        // if the player cannot contact, return a failure
        const canContactResult = await contacting.canContact(userId);
        if (!canContactResult.success) return canContactResult;

        // if there are duplicate members, return a failure
        if (new Set(originalMembers).size !== originalMembers.length)
            return failure("A group chat must be created with at least 3 initial members.");

        // if the player does not have enough contact tokens, return a failure
        const playerData = await Player.findOne({ userId });
        if (playerData.contactTokens < config.groupChatTokenCost)
            return failure("You do not have enough contact tokens to create a group chat.");

        // if at least one of the original members cannot contact, return a failure
        for (const memberId of originalMembers) {
            const memberCanContactResult = await contacting.canContact(memberId);
            if (!memberCanContactResult.success) return failure(`You cannot create a group chat with <@${memberId}>. Reason: ${memberCanContactResult.message}`);
        }

        // create the groupchat
        const allMembers = Array.from(new Set([...originalMembers, userId]));
        const groupchatChannel = await util.createTemporaryChannel(
            config.guilds.main,
            `groupchat-${count + 1}`,
            config.categoryPrefixes.groupchat,
            [{ ids: allMembers, perms: config.loungeMemberPermissions }]
        );

        // add the channel id to each member's lounge channel ids array, update all member's data
        const promises = [];
        for (const memberId of allMembers)
            promises.push((async () => {
                const memberData = await Player.findOne({ userId: memberId });
                if (!memberData) return;
                memberData.loungeChannelIds.push(groupchatChannel.id);
                await memberData.save();
            })());
        promises.push((async () => {
            playerData.contactTokens = Math.max(0, playerData.contactTokens - config.groupChatTokenCost);
            await playerData.save();
        })());
        await Promise.all(promises);

        await GroupChat.create({
            channelId: groupchatChannel.id,
            memberIds: allMembers,
            ownerId: userId,
        });

        // send the creation messages
        if (groupchatChannel.isSendable()) {
            await groupchatChannel.send(`**Groupchat created by <@${userId}>.**`);
            await groupchatChannel.send(allMembers.map(id => `<@${id}>`).join(" "));
        }

        // log the creation

        return success(`Groupchat created successfully: ${groupchatChannel}`);
    },

    async addToGroupchat(userId: string, targetId: string, groupchatId: string): Promise<Result> {
        // if the player cannot do a groupchat action, return a failure
        const canDoGroupchatActionResult = await contacting.canDoGroupchatAction(userId, groupchatId);
        if (!canDoGroupchatActionResult.success) return canDoGroupchatActionResult;

        // if the target cannot contact, return a failure
        const targetCanContactResult = await contacting.canContact(targetId);
        if (!targetCanContactResult.success) return targetCanContactResult;

        // if the target is already in the group chat, return a failure
        const groupchat = await GroupChat.findOne({ channelId: groupchatId });
        if (groupchat.memberIds.includes(targetId)) return failure("This person is already in the group chat.");

        // add the target to the group chat
        await util.addPermissionsToChannel(groupchatId, [{
            ids: [targetId],
            perms: config.loungeMemberPermissions
        }]);

        // update the target's data and the group chat's data
        await Player.findOneAndUpdate({ userId: targetId }, { $push: { loungeChannelIds: groupchatId } });
        groupchat.memberIds.push(targetId);
        await groupchat.save();

        // send the addition message
        const channel = await client.channels.fetch(groupchatId);
        if (channel.isSendable())
            await channel.send(`**<@${targetId}> has been added to the groupchat.**`);

        // log the addition

        return success(`Successfully added <@${targetId}> to the groupchat.`);
    },

    async removeFromGroupchat(userId: string, targetId: string, channelId: string): Promise<Result> {
        // if the player cannot do a group chat action, return a failure
        const canDoGroupchatActionResult = await contacting.canDoGroupchatAction(userId, channelId);
        if (!canDoGroupchatActionResult.success) return canDoGroupchatActionResult;

        // if the target is not in the group chat, return a failure
        const groupchat = await GroupChat.findOne({ channelId });
        if (!groupchat.memberIds.includes(targetId)) return failure("This person is not in the group chat.");

        // remove the target from the group chat
        await util.deletePermissionsToChannel(channelId, [targetId]);
        await Player.findOneAndUpdate({ userId: targetId }, { $pull: { loungeChannelIds: channelId } });
        await GroupChat.updateOne({ channelId: channelId }, { $pull: { memberIds: targetId } });

        // send the removal message
        const channel = await client.channels.fetch(channelId);
        if (channel.isSendable())
            await channel.send(`**<@${targetId}> has been removed from the groupchat.**`);

        // log the removal

        return success(`Successfully removed <@${targetId}> from the groupchat.`);
    },

    async changeGroupchatOwner(userId: string, targetId: string, channelId: string): Promise<Result> {
        // if the channel is not a group chat, return a failure
        const groupchat = await GroupChat.findById(channelId);
        if (!groupchat) return failure("This channel is not a group chat.");

        // if the player is not the owner of the group chat, return a failure
        if (groupchat.ownerId !== userId) return failure("You are not the owner of this group chat.");

        // if the target is not in the group chat, return a failure
        if (!groupchat.memberIds.includes(targetId)) return failure("This person is not in the group chat.");

        // if the player is trying to make themself the owner, return a failure
        if (targetId === userId) return failure("You are already the owner of this group chat.");

        await GroupChat.updateOne({ channelId }, { ownerId: targetId });

        // send the ownership change message
        const channel = await client.channels.fetch(channelId);
        if (channel.isSendable())
            await channel.send(`**<@${targetId}> is now the owner of the groupchat.**`);

        // log the ownership change

        return success(`Successfully made <@${targetId}> the new owner of the groupchat.`);
    },

    async setGroupchatName(userId: string, newName: string, channelId: string): Promise<Result> {
        // if the player cannot do a group chat action, return a failure
        const canDoGroupchatActionResult = await contacting.canDoGroupchatAction(userId, channelId);
        if (!canDoGroupchatActionResult.success) return canDoGroupchatActionResult;

        // set the new name of the group chat
        const channel = await client.channels.fetch(channelId);
        if (!channel.isDMBased())
            await channel.setName(newName).catch(() => { });

        return success(`Successfully changed the groupchat name to ${newName}.`);
    },

    async closeLounge(userId: string, loungeId: number) {
        // if lounge id is not actually a lounge, return
        const lounge = await Lounge.findOne({ loungeId });
        if (!lounge) return;

        // if the user has no data, return
        const userData = await Player.findOne({ userId });

        // if the user is not a member of the lounge, return
        if (lounge.contactorId !== userId && lounge.contactedId !== userId) return;

        // find closer alias (don't want to leak them if the lounge was anonymous)
        const alias = lounge.anonymous && lounge.contactorId === userId ? userData.role : await names.getAlias(userId);

        // remove the user's perms from all of the lounge's channels and remove the channel id from the user's data
        // also send the notification message
        for (const channelId of lounge.channelIds) {
            await util.deletePermissionsToChannel(channelId, [userId]);
            await Player.updateOne({ userId }, { $pull: { loungeChannelIds: channelId } });
            const channel = await client.channels.fetch(channelId);
            if (channel.isSendable()) await channel.send(`**${alias}** has closed the lounge.`);
        }
    },

    async leaveGroupchat(userId: string, channelId: string) {
        // if groupchat is not actually a groupchat, return
        const groupchat = await GroupChat.findOne({ channelId });
        if (!groupchat) return;

        // if the user has no data, return
        const userData = await Player.findOne({ userId });
        if (!userData) return;

        // if the user is not a member of the group chat, return
        if (!groupchat.memberIds.includes(userId)) return;

        // get alias for leave message
        const alias = await names.getAlias(userId);

        // remove the user's perms from all of the gc's channel and remove the channel id from the user's data
        // also send the notification message
        await util.deletePermissionsToChannel(channelId, [userId]);
        await Player.updateOne({ userId }, { $pull: { loungeChannelIds: channelId } });
        const channel = await client.channels.fetch(channelId);
        if (channel.isSendable()) await channel.send(`**${alias}** has left the groupchat.`);

        // log it
        const timeString = `<t:${Math.floor(Date.now() / 1000)}:F>`;
        const logMessage = `**${alias}** left a group chat at ${timeString}`;
        await contacting.sendLogMessage(logMessage, userData.flags.get("underTheRadar"));
    },

    async sendLogMessage(logMessage: string, underTheRadar: boolean) {
        // log to hosts no matter what
        const hostLogs = await client.channels.fetch(config.channels.hostLogs);
        if (hostLogs.isSendable()) await hostLogs.send(logMessage);

        // if under the radar, stop here
        if (underTheRadar) return;

        // if watari is alive, log to l and watari
        const aliveWatariCount = await Player.countDocuments({
            role: "Watari",
            "flags.alive": true,
        })
        if (aliveWatariCount > 0) {
            const lwatariLogs = await client.channels.fetch(config.channels.watariContactLogs);
            if (lwatariLogs.isSendable()) await lwatariLogs.send(logMessage);
        }

        // log to stolen contact logs
        const stolen = await client.channels.fetch(config.channels.stolenContactLogs);
        if (stolen.isSendable()) await stolen.send(logMessage);
    },

    async logContact(userId: string, targetId: string, anonymous: boolean): Promise<void> {
        // if no data, don't log. should be impossible anyway.
        const userData = await Player.findOne({ userId });
        if (!userData) return;

        // construct the info strings
        const contactorStr = anonymous ? `**${userData.role}**` : `**${await names.getAlias(userId)}**`;
        const contactedStr = `**${names.getAlias(targetId)}**`;
        const timeString = `<t:${Math.floor(Date.now() / 1000)}:F>`;
        const logMessage = `${contactorStr} contacted ${contactedStr} at ${timeString}`

        // send log message
        await contacting.sendLogMessage(logMessage, userData.flags.get("underTheRadar"));
    },

    async logGroupchatAddition(userId: string, targetId: string) {
        // if no data, don't log. should be impossible anyway.
        const userData = await Player.findOne({ userId });
        if (!userData) return;

        // construct info strings
        const contactorStr = `**${await names.getAlias(userId)}**`;
        const contactedStr = `**${names.getAlias(targetId)}**`;
        const timeString = `<t:${Math.floor(Date.now() / 1000)}:F>`;
        const logMessage = `${contactorStr} added ${contactedStr} to a group chat at ${timeString}`

        // send log message
        await contacting.sendLogMessage(logMessage, userData.flags.get("underTheRadar"));
    },

    async logGroupchatRemoval(userId: string, targetId: string) {
        // if no data, don't log. should be impossible anyway.
        const userData = await Player.findOne({ userId });
        if (!userData) return;

        // construct info strings
        const contactorStr = `**${await names.getAlias(userId)}**`;
        const contactedStr = `**${names.getAlias(targetId)}**`;
        const timeString = `<t:${Math.floor(Date.now() / 1000)}:F>`;
        const logMessage = `${contactorStr} added ${contactedStr} to a group chat at ${timeString}`

        // send log message
        await contacting.sendLogMessage(logMessage, userData.flags.get("underTheRadar"));
    },

    async logGroupchatCreation(userId: string, originalMembers: string[]) {
        // if no data, don't log. should be impossible anyway.
        const userData = await Player.findOne({ userId });
        if (!userData) return;

        // construct info strings
        const contactorStr = `**${await names.getAlias(userId)}**`;
        const contactedStrs = originalMembers.map(async (targetId) => `**${await names.getAlias(targetId)}**`);
        const timeString = `<t:${Math.floor(Date.now() / 1000)}:F>`;
        const logMessage = `${contactorStr} created a group chat with ${contactedStrs.join(", ")} at ${timeString}`;

        // send log message
        await contacting.sendLogMessage(logMessage, userData.flags.get("underTheRadar"));
    },

};

export default contacting;