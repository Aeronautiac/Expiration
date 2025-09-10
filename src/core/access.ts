import { Client } from "discord.js";
import config from "../../gameconfig.json";

import Player from "../models/player";

let client: Client;

interface access {
    init: (newClient: Client) => void,
    grant: (userId: string, guildId: string) => Promise<void>,
    revoke: (userId: string, guildId: string) => Promise<void>,
    revokeAll: (userId: string) => Promise<void>,
    grantRole: (userId: string) => Promise<void>,
    revokeGroup: (userId: string) => Promise<void>,
    grantGroup: (userId: string) => Promise<void>,
};

const access: Partial<access> = {};

access.init = function(newClient) {
    client = newClient;
}

//////////////////////////////////////////////////////

access.grant = async function(userId, guildId) {
    const user = await client.users.fetch(userId);
    const guild = await client.guilds.fetch(guildId);

    const invitePrefix = `https://discord.gg/`;

    // we need player data to handle this. if there is no player data, return early.
    const playerData = await Player.findOne({ userId });
    if (!playerData) {
        console.warn("Cannot grant access to guild. Player has no data.");
        return;
    }
        
    async function sendInvite(code: string) {
        try {
            await user.send(`${invitePrefix}${code}`);
        } catch (err) {
            console.log("Failed to send guild invite to user.", err);
        }
    }

    // check if the player already has access
    if (playerData.invites.has(guildId)) return;

    // check if the guildId is valid
    if (!Object.values(config.guildIds).includes(guildId)) {
        console.warn("Cannot grant access to a guild that does not exist (invalid guild id).");
        return;
    }

    // main discord should not be part of the guild access system
    if (guildId === config.guildIds.main)
        return;

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
        console.warn(`Cannot create guild invite in ${guild.name}. No suitable channel or invalid permissions.`);
        return;
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
    await playerData.save();

    await sendInvite(invite.code);

    return;
}

// restricts access to a server by banning the player and deleting their invite if they have one
access.revoke = async function(userId, guildId) {
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
    await guild.bans.create(userId).catch(() => {});

    return;
}

// restricts access from all game guilds except main
access.revokeAll = async function(userId) {
    const promises = Object.entries(config.guildIds).map(async ([guildName, guildId]) => {
        try {
            if (guildName === "main") return;
            await access.revoke(userId, guildId);
        } catch (err) {
            console.warn(`Failed to revoke access from guild ${guildName}:`, err);
        }
    });
    await Promise.all(promises);
}

// grants access to role guilds based on the player's role
access.grantRole = async function(userId) {
    const playerData = await Player.findOne({ userId });
    if (!playerData) return;

    const role = playerData.role;
    const guildsToGrant: string[] = config.roleGuilds[role] || [];

    const promises = guildsToGrant.map(async (guildName) => {
        const guildId = config.guildIds[guildName];
        await access.grant(userId, guildId);
    })
    await Promise.allSettled(promises);
}

// restricts access from all group guilds
access.revokeGroup = async function(userId) {
    const promises = config.groupGuilds.map(async (guildName) => {
        await access.revoke(userId, config.guildIds[guildName]);
    });
    await Promise.allSettled(promises);
}

// grants access to all group guilds that the player should have access to based on their affiliations and roles
access.grantGroup = async function(userId) {
    const playerData = await Player.findOne({ userId });
    if (!playerData) return;

    const guildsToGrant = new Set<string>();

    // add affiliation guilds
    const affiliations = playerData.affiliations || [];
    for (const affiliation of affiliations) {
        const orgGuilds = config.affiliationGuilds[affiliation] || [];
        for (const guildName of orgGuilds) {
            guildsToGrant.add(guildName);
        }
    }

    // add any role guilds that are also group guilds
    const role = playerData.role;
    const roleGuilds = config.roleGuilds[role] || [];
    for (const guildName of roleGuilds) {
        if (config.groupGuilds.includes(guildName)) {
            guildsToGrant.add(guildName);
        }
    }

    for (const guildName of guildsToGrant) {
        const guildId = config.guildIds[guildName];
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (guild) await access.grant(userId, guild);
    }
}

//////////////////////////////////////////////////////

export default access;