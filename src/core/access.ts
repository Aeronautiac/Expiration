import { Client } from "discord.js";
import { config } from "../configs/config";

import Player from "../models/player";
import { OrganisationName } from "../configs/organisations";
import util from "./util";
import { ChannelName } from "../configs/channels";

let client: Client;

interface access {
    init: (newClient: Client) => void;
    grant: (userId: string, guildIds: string[]) => Promise<void>;
    grantAll: (userId: string) => Promise<void>;
    revoke: (userId: string, guildId: string) => Promise<void>;
    revokeAll: (userId: string) => Promise<void>;
    grantRole: (userId: string) => Promise<void>;
    revokeGroup: (userId: string) => Promise<void>;
    grantGroup: (userId: string) => Promise<void>;
    grantChannels: (userId: string) => Promise<void>;
    grantOrgChannels: (userId: string) => Promise<void>;
    revokeChannels: (userId: string) => Promise<void>;
    updateChannels: (userId: string) => Promise<void>;
}

const access: Partial<access> = {};

access.init = function (newClient) {
    client = newClient;
};

//////////////////////////////////////////////////////

access.grant = async function (userId, guildIds) {
    console.log(`granting access to: ${guildIds}`);
    const user = await client.users.fetch(userId);
    const invitePrefix = `https://discord.gg/`;

    // we need player data to handle this. if there is no player data, return early.
    const playerData = await Player.findOne({ userId });
    if (!playerData) {
        console.warn("Cannot grant access to guild. Player has no data.");
        return;
    }

    let inviteMessage: string = `${user} You have been invited to: `
    let secondInviteMessage: string = "" // This is for when the number of invites are over 10.
    let guildsInvitedTo: number = 0;
    for (const guildId of guildIds) {
        const guild = await client.guilds.fetch(guildId);

        // check if the player already has access
        if (playerData.invites.has(guildId)) continue;

        // check if the guildId is valid
        if (!(Object.values(config.guilds) as string[]).includes(guildId)) {
            console.warn(
                "Cannot grant access to a guild that does not exist (invalid guild id)."
            );
            continue;
        }

        // main discord should not be part of the guild access system
        if (guildId === config.guilds.main) continue;

        // create and add the invite to their data
        const channels = await guild.channels.fetch().catch(() => new Map());
        const channel =
            guild.systemChannel ||
            [...channels.values()].find(
                (c) =>
                    c.isTextBased() &&
                    c.permissionsFor(guild.members.me).has("CreateInstantInvite")
            );

        if (!channel) {
            console.warn(
                `Cannot create guild invite in ${guild.name}. No suitable channel or invalid permissions.`
            );
            continue;
        }

        // if they were banned, unban them
        const ban = await guild.bans.fetch(userId).catch(() => null);
        if (!ban) {
            console.log(`User ${userId} is not banned, skipping unban.`);
        } else {
            await guild.bans.remove(userId);
            console.log(`Unbanned user ${userId}`);
        }

        const invite = await channel.createInvite({
            maxUses: 1,
            unique: true,
        });

        playerData.invites.set(guildId, invite.code);
        guildsInvitedTo += 1;
        if (guildsInvitedTo <= 10) inviteMessage += `\n${invitePrefix}${invite.code}`;
        if (guildsInvitedTo > 10) secondInviteMessage += `\n${invitePrefix}${invite.code}`;
    }

    await playerData.save();

    if (guildsInvitedTo === 0) return;
    await util.sendToUser(userId, inviteMessage);
    if (secondInviteMessage !== "") await util.sendToUser(userId, secondInviteMessage);

    return;
};

// grants access to all organisation servers & role servers
access.grantAll = async function (userId) {
    await access.grant(userId, Object.values(config.guilds) as string[]);
};

// restricts access to a server by banning the player and deleting their invite if they have one
access.revoke = async function (userId, guildId) {
    console.log(`Revoking access to ${guildId}`);
    const guild = await client.guilds.fetch(guildId);

    // we need player data to handle this. if there is no player data, return false.
    const playerData = await Player.findOne({ userId });
    if (!playerData) {
        console.warn("Player has no data. Cannot revoke access to guild.");
        return;
    }

    // remove the invite from their data and delete the invite
    const inviteCode = playerData.invites.get(guildId);
    if (inviteCode) {
        const invite = await guild.invites.fetch(inviteCode).catch(() => null);
        if (invite) await invite.delete("revoking access");
    }
    playerData.invites.delete(guildId);
    await playerData.save();

    // ban the player from the guild
    await guild.bans.create(userId).catch(() => null);

    return;
};

// restricts access from all game guilds except main
access.revokeAll = async function (userId) {
    const promises = Object.entries(config.guilds).map(
        async ([guildName, guildId]) => {
            try {
                if (guildName === "main") return;
                await access.revoke(userId, guildId);
            } catch (err) {
                console.warn(
                    `Failed to revoke access from guild ${guildName}:`,
                    err
                );
            }
        }
    );
    await Promise.all(promises);
};

// grants access to role and org locked channels based on the player's role and org rank
access.grantChannels = async function (userId) {
    const playerData = await Player.findOne({ userId });
    if (!playerData) {
        console.warn("Player has no data. Cannot add to channels.");
        return;
    }

    // role stuff
    const roleChannels = Object.values(
        config.roles[playerData.role].guildChannels
    ).flat();

    // group stuff
    const memberObjects = await util.getMemberObjects(userId);
    const groupChannels = memberObjects
        .map((obj) => {
            if (obj.leader)
                return config.organisations[obj.org]["leaderChannel"];
        })
        .filter(Boolean);

    const channelsToGrant = Array.from(
        new Set<ChannelName>([...roleChannels, ...groupChannels])
    );
    const channelPermPromises = channelsToGrant.map(async (ch) => {
        await util
            .addPermissionsToChannel(config.channels[ch], [
                {
                    ids: [userId],
                    perms: {
                        ViewChannel: true,
                    },
                },
            ])
            .catch(() => {});
    });
    await Promise.all(channelPermPromises);
};

// revokes access from all restricted channels
access.revokeChannels = async function (userId) {
    const playerData = await Player.findOne({ userId });
    if (!playerData) {
        console.warn("Player has no data. Cannot revoke from channels.");
        return;
    }
    const orgChannels = Object.values(config.organisations)
        .map((org) => org["leaderChannel"])
        .filter(Boolean);
    const roleChannels = Object.values(config.roles)
        .map((role) => Object.values(role.guildChannels))
        .flat();
    const channelsToRevoke = new Set<ChannelName>([
        ...orgChannels,
        ...roleChannels,
    ]);
    const channels = Array.from(channelsToRevoke);
    const channelPermPromises = channels.map(async (ch) => {
        await util
            .deletePermissionsToChannel(config.channels[ch], [userId])
            .catch(() => {});
    });
    await Promise.all(channelPermPromises);
};

// revokes and then grants access to restricted channe;s
access.updateChannels = async function (userId) {
    await access.revokeChannels(userId);
    await access.grantChannels(userId);
};

// grants access to role guilds based on the player's role
access.grantRole = async function (userId) {
    const playerData = await Player.findOne({ userId });
    if (!playerData) return;

    const role = playerData.role;
    const guildsToGrant: string[] = config.roles[role].guilds || [];
    const guildIds = guildsToGrant.map((guildName) => config.guilds[guildName]);
    await access.grant(userId, guildIds);
};

// restricts access from all group guilds
access.revokeGroup = async function (userId) {
    const promises = config.groupGuilds.map(async (guildName) => {
        await access.revoke(userId, config.guilds[guildName]);
    });
    await Promise.allSettled(promises);
};

// grants access to all group guilds that the player should have access to based on their affiliations and roles
access.grantGroup = async function (userId) {
    const playerData = await Player.findOne({ userId });
    if (!playerData) return;

    const guildsToGrant = new Set<string>();

    // add affiliation guild
    const memberObjects = await util.getMemberObjects(userId);
    for (const member of memberObjects) {
        const orgConfig = config.organisations[member.org];
        guildsToGrant.add(orgConfig.guild);
    }

    // add any role guilds that are also group guilds
    const role = playerData.role;
    const roleGuilds = config.roles[role].guilds || [];
    for (const guildName of roleGuilds) {
        if ((config.groupGuilds as string[]).includes(guildName)) {
            guildsToGrant.add(guildName);
        }
    }

    const guildIds = Array.from(guildsToGrant).map((guildName) => config.guilds[guildName]);
    await access.grant(userId, guildIds);
};

//////////////////////////////////////////////////////

export default access;
