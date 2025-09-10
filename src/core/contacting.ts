import { Client } from "discord.js";
import Player from "../models/player";
import access from "./access";
import { config } from "../configs/config";

let client: Client;

const contacting = {
    
    init: function(newClient: Client) {
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
        const playerData = await Player .findOne({ userId });
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

    async contact(userId: string, targetId: string): Promise<void> {

    },

}

export default contacting;