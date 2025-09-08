import { Client, Guild, Role } from "discord.js";
import fs from "fs";
import config from "../../gameconfig.json";
import access from "./access";

import Player, { GameRole } from "../models/playerts";
import Notebook from "../models/notebookts";

let client: Client;

interface Game {
    init: (newClient: Client) => void,
    // name
    getAlias: (userId: string) => Promise<string>,
    setNickname: (userId: string, nickname: string) => Promise<void>,
    getRandomName: () => Promise<string>,
    // core
    role: (userId: string, role: GameRole, trueName?: string) => Promise<void>,
    // notebooks
    setNotebook: (guildId: string, ownerId: string, temporary?: boolean) => Promise<void>,
    addNotebookRestrictor: (userId: string, reason: string) => Promise<void>,
    removeNotebookRestrictor: (userId: string, reason: string) => Promise<void>,
    // contacting
    addLoungeHider: (userId: string, reason: string) => Promise<void>,
    removeLoungeHider: (userId: string, reason: string) => Promise<void>,
    contact: (userId: string, targetId: string) => Promise<void>,
};

const game: Partial<Game> = {};

game.init = function(newClient) {
    client = newClient;
}

//////////////////////////////////////////////////////
const first_names = fs
    .readFileSync("./first_names.txt", "utf-8")
    .split("\n")
    .filter(Boolean);
const last_names = fs
    .readFileSync("./last_names.txt", "utf-8")
    .split("\n")
    .filter(Boolean);

function rawName(name: string): string {
    return name
        .replace(/[^a-zA-Z\s]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
}

function readableName(name: string) {
    return name
        .toLowerCase()
        .trim() // remove leading/trailing spaces and newlines
        .split(/\s+/) // split on any whitespace (spaces, tabs, newlines)
        .map(
            (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" "); // join with single space
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

game.getAlias = async function(userId) {
    try {
        const mainGuild: Guild = await client.guilds.fetch(config.guildIds.main);
        const member = await mainGuild.members.fetch(userId);
        return member.displayName.replace(/\*/g, "").replace(/\s*\(IPP\)$/, "");
    } catch (err) {
        console.warn(`Failed to get alias for user ${userId}`);
        return "";
    }
};

// sets the user's nickname to the supplied nickname in all game guilds
game.setNickname = async function(userId, nickname) {
    const promises = Object.entries(config.guildIds).map(async ([name, id]) => {
        try {
            const guild = await client.guilds.fetch(id);
            const member = await guild.members.fetch(userId);
            await member.setNickname(nickname);
        } catch (err) {
            console.warn(`Failed to set nickname in guild ${name}:`, err);
        }
    });
    await Promise.all(promises);
};

game.getRandomName = async function() {
    const usedNames = await Player.distinct("trueName");

    let fullName: string;

    while (true) {
        const firstName =
            first_names[Math.floor(Math.random() * first_names.length)];
        const lastName =
            last_names[Math.floor(Math.random() * last_names.length)];

        fullName = `${firstName} ${lastName}`;
        if (!usedNames.includes(rawName(fullName))) break;
    }

    return fullName;
}

//////////////////////////////////////////////////////

// creates a player's data if there is none, gives the player the role specified, and revives them if they were dead
// also returns their notebooks if they owned any and their notebooks were not taken from them
// bans from all guilds except main. Unbans and invites to role guilds.
game.role = async function(userId, role, trueName) {
    let playerData = await Player.findOne({userId});
    const user = await client.users.fetch(userId);

    if (!playerData) {
        const name = trueName ?? (await game.getRandomName());

        playerData = await Player.create({
            userId,
            role,
            trueName,
            contactTokens: config.dailyTokens,
        });

        await user.send(`Your true name is ${readableName(name)}`);
    } else {
        await Player.updateOne({userId}, {
            $set: {"flags.alive": true, role}
        })

        const notebooks = await Notebook.find({ currentOwner: userId });
        for (const notebook of notebooks) {
            try {
                await game.setNotebook(notebook.guildId, userId);
            } catch (err) {
                console.log("Failed to return notebook after revival:", err);
            }
        }
    }

    // restricts access to all guilds except main (this is called no matter what because your role could change even while alive.)
    // remove all old role abilities
    await removeOldAbilities(targetUser);
    await access.revokeAll(userId);

    // grants access to role guilds and abilities
    await grantRoleAbilities(targetUser, role);
    await access.grantRole(userId);

    await game.removeLoungeHider(userId, "dead");

    // roles
    const mainGuild = await client.guilds.fetch(config.guildIds.main);
    const member = await mainGuild.members
        .fetch(userId)
        .catch(() => null);
    if (member) {
        await member.roles
            .add(config.roleIds.Civilian)
            .catch(console.error);
        await member.roles
            .remove(config.roleIds.Shinigami)
            .catch(console.error);
    }
}

//////////////////////////////////////////////////////

// if guild is not a notebook yet, this function creates a new notebook and sets the current and original owner to owner.
// if guild is already a notebook, the notebook's current owner is updated to the next owner.
// grants and revokes guild access as necessary.
// if temporary is true, then instead of current owner being changed, temporary owner is changed. notebooks with temporary owners
// are sent back to their current owners when the next day begins even if the temporary owner died with it.
game.setNotebook = async function(guildId, ownerId, temporary) {
    const existingBook = await Notebook.findOne({ guildId });

    if (existingBook) {
        const currentHolder =
            existingBook.temporaryOwner ?? existingBook.currentOwner;
        const newHolder = ownerId;

        // if the current holder and new holder are the same, do nothing
        if (currentHolder === newHolder) return;

        // if temporary, change the temporary owner field, otherwise, change current owner
        if (temporary) {
            await Notebook.updateOne(
                { _id: existingBook._id },
                { $set: { temporaryOwner: ownerId } }
            );
        } else {
            if (existingBook.currentOwner !== ownerId)
                await Notebook.updateOne(
                    { _id: existingBook._id },
                    { $set: { currentOwner: ownerId } }
                );
        }

        // if the person holding the notebook, changed, revoke access from the old and grant to the new.
        if (newHolder !== currentHolder) {
            await access.revoke(currentHolder, guildId);
            await access.grant(newHolder, guildId);
        }

        // if the notebook was being held temporarily before the posession change, then remove the temporary owner field
        if (existingBook.temporaryOwner && !temporary) {
            await Notebook.updateOne(
                { _id: existingBook._id },
                { $unset: { temporaryOwner: "" } }
            );
        }

        return;
    }

    await Notebook.create({
        guildId,
        currentOwner: ownerId,
        originalOwner: ownerId,
    });

    await access.grant(ownerId, guildId);
}

game.addNotebookRestrictor = async function(userId, reason) {
    const playerData = await Player.findOne({ userId });
    if (!playerData) return;
    
    playerData.notebookRestrictors.set(reason, true);
    await playerData.save();
}

game.removeNotebookRestrictor = async function(userId, reason) {
    const playerData = await Player.findOne({ userId });
    if (!playerData) return;

    playerData.notebookRestrictors.delete(reason);
    await playerData.save();
}

//////////////////////////////////////////////////////
const loungePerms = {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AttachFiles: true,
    EmbedLinks: true,
    UseExternalEmojis: true,
    AddReactions: true,
}

game.addLoungeHider = async function(userId, reason) {
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
}

game.removeLoungeHider = async function(userId, reason) {
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
            await lounge.permissionOverwrites.edit(userId, loungePerms);
        } catch (err) {
            console.log("Failed to add channel perms:", err);
        }
    });
    await Promise.all(promises);
    await access.grantGroup(userId);
}

game.contact = async function(userId, targetId) {
    
}
//////////////////////////////////////////////////////

export default game;