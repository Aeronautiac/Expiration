require("dotenv").config();
const fs = require("fs");
const {
    ChannelType,
    PermissionsBitField,
    PermissionFlagsBits,
} = require("discord.js");
const { mongoose } = require("./mongoose");
const Player = require("./models/player");
const Ability = require("./models/ability");
const Lounge = require("./models/lounge");
const Season = require("./models/season");
const BugLog = require("./models/bugLog");
const Notebook = require("./models/notebook");
const Organisation = require("./models/organisation");
const ScheduledDeath = require("./models/scheduledDeath");
const KidnapLounge = require("./models/kidnaplounge");
const DelayedAction = require("./models/delayedAction");
const gameConfig = require("../gameconfig.json");
const first_names = fs
    .readFileSync("./first_names.txt", "utf-8")
    .split("\n")
    .filter(Boolean);
const last_names = fs
    .readFileSync("./last_names.txt", "utf-8")
    .split("\n")
    .filter(Boolean);

async function getRandomName() {
    const usedNames = await Player.distinct("trueName");

    let fullName;

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

async function updatePlayerData(user, updates) {
    return await Player.findOneAndUpdate(
        { userId: user.id },
        { $set: updates },
        { new: true, upsert: false }
    );
}

async function updateOrganisationData(organisationName, updates) {
    return await Organisation.findOneAndUpdate(
        { organisation: organisationName },
        { $set: updates },
        { new: true, upsert: false }
    );
}

async function getPlayerData(user) {
    return await Player.findOne({ userId: user.id });
}

// invite system

// grants a user access to a guild.
async function grantAccess(user, guild) {
    const userId = user.id;
    const guildId = guild.id;
    const invitePrefix = `https://discord.gg/`;

    // we need player data to handle this. if there is no player data, return false.
    const playerData = await Player.findOne({ userId: user.id });
    if (!playerData) return "Player has no data. Cannot grant access to guild.";

    async function sendInvite(code) {
        try {
            await user.send(`${invitePrefix}${code}`);
        } catch (err) {
            console.log("Failed to send guild invite to user.", err);
        }
    }

    // check if the player already has access
    if (playerData.invites.has(guildId)) {
        // const code = playerData.invites.get(guildId);
        // await sendInvite(code);
        return true; // already has access
    }

    // check if the guildId is valid
    if (!Object.values(gameConfig.guildIds).includes(guildId))
        return "Invalid guild ID.";
    if (guildId === gameConfig.guildIds.main)
        return "Cannot grant access to the main guild.";

    // create and add the invite to their data
    const channels = await guild.channels.fetch().catch(() => new Map());
    const channel =
        guild.systemChannel ||
        [...channels.values()].find(
            (c) =>
                c.isTextBased() &&
                c.permissionsFor(guild.members.me).has("CreateInstantInvite")
        );

    if (!channel)
        return `Cannot create guild invite in ${guild.name}. No suitable channel or invalid permissions.`;

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

    return true;
}

// restricts access to a server by banning the player and deleting their invite if they have one
async function revokeAccess(user, guild) {
    const userId = user.id;
    const guildId = guild.id;

    // we need player data to handle this. if there is no player data, return false.
    const playerData = await Player.findOne({ userId });
    if (!playerData)
        return "Player has no data. Cannot revoke access to guild.";

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

    return true;
}

// restricts access from all game guilds except main
async function restrictGuildAccess(client, user) {
    for (const guildId of Object.values(gameConfig.guildIds)) {
        if (guildId === gameConfig.guildIds.main) continue;
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (guild) await revokeAccess(user, guild);
    }
}

// grants access to role guilds based on the player's role
async function grantRoleGuildAccess(client, user) {
    const playerData = await Player.findOne({ userId: user.id });
    if (!playerData) return;

    const role = playerData.role;
    const guildsToGrant = gameConfig.roleGuilds[role] || [];

    for (const guildName of guildsToGrant) {
        const guildId = gameConfig.guildIds[guildName];
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (guild) await grantAccess(user, guild);
    }
}

// restricts access from all group guilds
async function restrictGroupGuildAccess(client, user) {
    for (const guildName of gameConfig.groupGuilds) {
        const guildId = gameConfig.guildIds[guildName];
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (guild) await revokeAccess(user, guild);
    }
}

// grants access to all group guilds that the player should have access to based on their affiliations and roles
async function grantGroupGuildAccess(client, user) {
    const playerData = await Player.findOne({ userId: user.id });
    if (!playerData) return;

    const guildsToGrant = new Set();

    // add affiliation guilds
    const affiliations = playerData.affiliations || [];
    for (const affiliation of affiliations) {
        const orgGuilds = gameConfig.affiliationGuilds[affiliation] || [];
        for (const guildName of orgGuilds) {
            guildsToGrant.add(guildName);
        }
    }

    // add any role guilds that are also group guilds
    const role = playerData.role;
    const roleGuilds = gameConfig.roleGuilds[role] || [];
    for (const guildName of roleGuilds) {
        if (gameConfig.groupGuilds.includes(guildName)) {
            guildsToGrant.add(guildName);
        }
    }

    for (const guildName of guildsToGrant) {
        const guildId = gameConfig.guildIds[guildName];
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (guild) await grantAccess(user, guild);
    }
}

//

async function getOrganisationData(organisationName) {
    return await Organisation.findOne({ organisation: organisationName });
}

async function genericUseAbility(client, userId, abilityName) {
    const playerData = await Player.findOne({ userId });
    const abilityData = await Ability.findOne({
        ownerId: userId,
        ability: abilityName,
    });

    const season = await Season.findOne({});

    if (!season) return "No season is currently active.";
    if (!season.active) return "No season is currently active.";

    if (!playerData) return "Player data not found.";
    if (!playerData.alive) return "Player is not alive.";

    const ability = gameConfig.abilities[abilityName];
    if (!ability) return "Ability does not exist.";

    // check if the player owns the ability
    if (!abilityData) return "You do not own this ability.";

    // check if the ability has enough charges to be used today
    if (abilityData.charges !== undefined && abilityData.charges !== null)
        if (abilityData.charges <= 0)
            return "You do not have enough charges to use this ability.";

    // check if the ability is on cooldown
    if (abilityData.cooldown > 0) return "Ability is on cooldown.";

    // log
    try {
        if (client) {
            const mainGuild = await client.guilds.fetch(
                gameConfig.guildIds.main
            );
            const hostLogs = await mainGuild.channels.fetch(
                gameConfig.channelIds.hostLogs
            );
            const userMember = await mainGuild.members.fetch(userId);
            await hostLogs.send(
                `**${strippedName(
                    userMember.displayName
                )}** used **${abilityName}** at <t:${Math.floor(
                    Date.now() / 1000
                )}:F>`
            );
        }
    } catch (err) {
        console.log("Failed to log ability use:", err);
    }

    // charges
    // find default ability number based on the current day
    function getChargesBasedOnDay(chargeArray) {
        // array with index 0 corresponding to season day 1 and onward. the value in this index is the number of charges available on that day and beyond.
        // if there is no value at the index of the current day, then the value is the last index in the array.
        const currentDay = season.day - 1;
        return chargeArray[currentDay] || chargeArray[chargeArray.length - 1];
    }

    const defaultCharges = Array.isArray(ability.charges)
        ? getChargesBasedOnDay(ability.charges)
        : ability.charges;

    // if their charges for this ability have not been initialized today, initialize them.
    // if they have, then subtract 1 and clamp to 0.
    if (abilityData.charges === null || abilityData.charges === undefined) {
        abilityData.charges = defaultCharges - 1;
    } else {
        abilityData.charges = Math.max(0, abilityData.charges - 1);
    }

    // add ability to abilities used today. this is used to handle cooldown logic in nextday.
    // playerData.abilitiesUsedToday.push(abilityName);
    abilityData.usedToday = true;

    // save changes
    await abilityData.save();

    return true;
}

// call at the end of a day
async function applyAbilityCooldowns() {
    const abilitiesUsedToday = await Ability.find({ usedToday: true });

    for (const ability of abilitiesUsedToday) {
        const abilityConfig = gameConfig.abilities[ability.ability];
        ability.cooldown = abilityConfig.cooldown;
        ability.charges = undefined;
        ability.usedToday = false;
        await ability.save();
    }
}

async function removeOldAbilities(user) {
    await Ability.deleteMany({
        ownerId: user.id,
        persistsThroughRoleChange: false,
    });
}

async function giveRoleAbilities(user) {
    const playerData = await Player.findOne({ userId: user.id });
    if (!playerData) return;

    const role = playerData.role;
    const abilitiesToGive = gameConfig.roleAbilities[role] || [];

    for (const abilityName of abilitiesToGive) {
        const abilityConfig = gameConfig.abilities[abilityName];
        if (!abilityConfig) continue;
        const existingAbility = await Ability.findOne({
            ownerId: user.id,
            ability: abilityName,
        });
        if (existingAbility) continue; // player already has this ability
        await Ability.create({
            ownerId: user.id,
            ability: abilityName,
        });
    }
}

function rawName(name) {
    return name
        .replace(/[^a-zA-Z\s]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
}

function readableName(name) {
    return name
        .toLowerCase()
        .trim() // remove leading/trailing spaces and newlines
        .split(/\s+/) // split on any whitespace (spaces, tabs, newlines)
        .map(
            (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" "); // join with single space
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function hrsToMs(hrs) {
    return 1000 * 60 * 60 * hrs;
}

function minToMs(min) {
    return 1000 * 60 * min;
}

// creates a player's data if there is none, gives the player the role specified, and revives them if they were dead
// also returns their notebooks if they owned any and their notebooks were not taken from them
// bans from all guilds except main. Unbans and invites to role guilds.
async function role(client, targetUser, role, trueName) {
    let playerData = await getPlayerData(targetUser);
    if (!playerData) {
        // const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
        const name = trueName ?? (await getRandomName());
        // const monologueChannel = await createLoungeChannel(mainGuild, `${targetUser.username}-monologue`, "monologue", [targetUser]);

        playerData = await Player.create({
            userId: targetUser.id,
            role: role,
            alive: true,
            contactTokens: gameConfig.dailyTokens,
            kills: 0,
            trueName: rawName(name),
            // monologueChannelId: monologueChannel.id,
        });

        targetUser.send(`Your true name is ${readableName(name)}`);
    } else {
        playerData = await updatePlayerData(targetUser, {
            role: role,
            alive: true,
        });

        const notebooks = await Notebook.find({ currentOwner: targetUser.id });
        for (const notebook of notebooks) {
            try {
                setNotebook(
                    client,
                    await client.guilds.fetch(notebook.guildId),
                    targetUser.id
                );
            } catch (err) {
                console.log("Failed to return notebook after revival:", err);
            }
        }
    }

    // restricts access to all guilds except main (this is called no matter what because your role could change even while alive.)
    // remove all old role abilities
    await removeOldAbilities(targetUser);
    await restrictGuildAccess(client, targetUser);

    // grants access to role guilds and abilities
    await giveRoleAbilities(targetUser);
    await grantRoleGuildAccess(client, targetUser);

    await unhideLounges(client, targetUser, "dead");

    // roles
    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    const member = await mainGuild.members
        .fetch(targetUser.id)
        .catch(() => null);
    if (member) {
        await member.roles
            .add(gameConfig.roleIds.Civilian)
            .catch(console.error);
        await member.roles
            .remove(gameConfig.roleIds.Shinigami)
            .catch(console.error);
    }
}

// hides lounges from a player and restricts access to any group guilds.
async function hideLounges(client, user, reason) {
    var playerData = await getPlayerData(user);

    playerData = await updatePlayerData(user, {
        loungeHideReasons: [...playerData.loungeHideReasons, reason],
    });

    for (const channelId of playerData.loungeChannelIds) {
        try {
            const lounge = await client.channels.fetch(channelId);
            if (!lounge) continue;

            await lounge.permissionOverwrites.delete(user).catch(console.error);
        } catch (err) {
            console.log("Failed to remove channel perms:", err);
        }
    }

    await restrictGroupGuildAccess(client, user);
}

// unhides lounges from a player if they have no more hide reasons and grants access to group guilds that they should have access to.
async function unhideLounges(client, user, reason) {
    const channels = client.channels;
    var playerData = await getPlayerData(user);

    playerData = await updatePlayerData(user, {
        loungeHideReasons: playerData.loungeHideReasons.filter((entry) => {
            return entry !== reason;
        }),
    });

    if (playerData.loungeHideReasons.length > 0) return;

    for (const loungeId of playerData.loungeChannelIds) {
        const lounge = await channels.fetch(loungeId);
        if (!lounge) continue;

        await lounge.permissionOverwrites.edit(user.id, {
            ViewChannel: true,
        });
    }
    await grantGroupGuildAccess(client, user);
}

async function deathMessage(
    client,
    user,
    message,
    trueName,
    role,
    hasNotebook,
    affiliatiated,
    hasBugAbility
) {
    const readablename = readableName(trueName);
    const targetData = await getPlayerData(user);
    const affiliations = affiliatiated ?? targetData.affiliations;

    const news = await client.channels.fetch(gameConfig.channelIds.news);

    const deathReason = message ?? `They died from a sudden heart attack`;

    // Compose the base death message
    let output = `@everyone ${user} (${readableName(
        trueName
    )}) has died. ${deathReason}.`;

    // Send the initial death message
    const deathMsg = await news.send({
        content: output,
        allowedMentions: { parse: ["everyone"] },
    });

    // Wait 5 seconds before replying with the role/affiliation reveal
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Determine the role/affiliation reveal message
    let revealMsg = "";
    const roleName = String(role).trim();
    const affils = Array.isArray(affiliatiated) ? affiliatiated : [];

    // Helpers for mention formatting
    const roleMention = (r) => {
        // Try to find role id from config, fallback to plain text
        const id = gameConfig.roleIds[r];
        return id ? `<@&${id}>` : r;
    };
    const orgMention = (org) => {
        const id = gameConfig.roleIds[org];
        return id ? `<@&${id}>` : org;
    };

    if (roleName === "Civilian") {
        revealMsg = `They were just a `;
    } else if (roleName === "Kira") {
        revealMsg = `They were the mass murderer known as `;
    } else if (roleName === "L") {
        revealMsg = `They were the world's greatest detective known as `;
    } else if (roleName === "Rogue Civilian") {
        revealMsg = `They were the chaotic `;
    } else if (["PI", "News Anchor"].includes(roleName)) {
        revealMsg = `They were the `;
    } else {
        revealMsg = `They were `;
    }
    revealMsg += roleMention(roleName);

    const chiefs = affiliations.filter((a) => a.endsWith("Chief"));
    const orgs = affiliations.filter((a) => !a.endsWith("Chief"));

    if (orgs.length === 1 && chiefs.length === 0) {
        // Single org, not chief
        revealMsg += ` and member of the ${orgMention(orgs[0])}.`;
    } else if (orgs.length > 1 && chiefs.length === 0) {
        // Multiple orgs, not chief
        const mentions = orgs.map(orgMention);
        revealMsg += ` and members of the ${mentions
            .slice(0, -1)
            .join(", ")} and ${mentions.slice(-1)}.`;
    } else if (
        orgs.length === 1 &&
        chiefs.length === 1 &&
        chiefs[0].startsWith(orgs[0])
    ) {
        // Chief of their only org
        const chiefOrg = orgs[0];
        revealMsg += ` and the chief of the ${orgMention(
            chiefOrg
        )}. Now no new members may join the ${orgMention(chiefOrg)}.`;
    } else if (orgs.length > 0 && chiefs.length > 0) {
        // Member of orgs and also chief(s)
        const mentions = orgs.map(orgMention);
        let msg = ` and members of the ${mentions.slice(0, -1).join(", ")}${
            orgs.length > 1 ? " and " : ""
        }${mentions.slice(-1)}.`;
        // List all chief roles
        for (const chief of chiefs) {
            const chiefOrg = chief.replace(/ Chief$/, "");
            msg += ` They were also the chief of the ${orgMention(
                chiefOrg
            )}. Now no new members may join the ${orgMention(chiefOrg)}.`;
        }
        revealMsg += msg;
    }

    // Reply to the death message with the reveal
    await deathMsg.reply({
        content: revealMsg,
        allowedMentions: { parse: ["roles"] },
    });

    // If they had a notebook, announce it
    if (hasNotebook) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await deathMsg.reply({
            content: `Whoever is responsible has now gained possession of their death note(s).`,
        });
    }

    if (hasBugAbility) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await deathMsg.reply({
            content: `Whoever is responsible has now gained possession of their bug and contact log abilities.`,
        });
    }
}

// adds a cooldown to a player's data
async function addCooldown(user, ability, cooldown) {
    const playerData = await getPlayerData(user);

    const newCds = playerData.cooldowns;
    newCds.set(ability, cooldown);
    await updatePlayerData(user, {
        cooldowns: newCds,
    });
}

async function addOrganisationCooldown(organisationName, ability, cooldown) {
    const orgData = await getOrganisationData(organisationName);

    const newCds = orgData.cooldowns;
    newCds.set(ability, cooldown);
    await updateOrganisationData(organisationName, {
        cooldowns: newCds,
    });
}

// returns true if there is at least one player alive with the role supplied
async function isRoleAlive(role) {
    const playersAliveWithRole = await Player.find({ role: role, alive: true });
    return playersAliveWithRole.length > 0;
}

async function addUsersToChannel(users, channel) {
    for (const user of users) {
        await channel.permissionOverwrites.create(user.id, {
            ViewChannel: true,
        });
    }
}

async function removeUsersFromChannel(users, channel) {
    for (const user of users) {
        await channel.permissionOverwrites.delete(user.id);
    }
}

// places a user into custody
// custody restricts notebook usage and bugs the player with source "custody"
// this function will give them the custody role
async function custody(client, user) {
    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    const member = await mainGuild.members.fetch(user.id).catch(() => null);

    // restrict notebook usage
    await restrictNotebooks(user, "custody");

    // bug the player with the custody source
    await bugUser(client, user, "custody");

    // add role
    if (member) await member.roles.add(gameConfig.roleIds.Custody);
}

// removes custody effects from a user
async function removeCustody(client, user) {
    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    const member = await mainGuild.members.fetch(user.id).catch(() => null);

    // free notebook usage
    await freeNotebooks(user, "custody");

    // remove the custody bug
    await BugLog.deleteMany({ targetId: user.id, source: "custody" });

    // remove role
    if (member)
        await member.roles.remove(gameConfig.roleIds.Custody).catch(() => {});
}

async function createTemporaryChannel(
    guild,
    channelName,
    categoryPrefix,
    users
) {
    const allChannels = await guild.channels.fetch();

    // get all channel categories with category prefix and sort them based on their number
    const categories = allChannels
        .filter(
            (channel) =>
                channel.type === ChannelType.GuildCategory &&
                channel.name.startsWith(categoryPrefix)
        )
        .sort((a, b) => {
            const numA = parseInt(a.name.replace(categoryPrefix, ""));
            const numB = parseInt(b.name.replace(categoryPrefix, ""));
            return numA - numB;
        });

    // find the least numbered category that has an available space for a new channel
    let chosenCategory = null;
    let categoryNumber = 1;
    for (const category of categories.values()) {
        const children = allChannels.filter((c) => c.parentId === category.id);

        if (children.size < gameConfig.maxChannelsPerCategory) {
            chosenCategory = category;
            break;
        }

        categoryNumber++;
    }

    // if there is no category available, create a new one
    if (!chosenCategory) {
        const newCategory = await guild.channels.create({
            name: `${categoryPrefix}${categoryNumber}`,
            type: ChannelType.GuildCategory,
        });

        chosenCategory = newCategory;
    }

    // create the channel and add every member to it
    const permissionOverwrites = [];

    if (users === "everyone") {
        permissionOverwrites.push({
            id: guild.roles.everyone.id,
            allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.AttachFiles,
                PermissionsBitField.Flags.EmbedLinks,
            ],
        });
    } else {
        permissionOverwrites.push({
            id: guild.roles.everyone.id,
            deny: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
            ],
        });

        for (const user of users) {
            permissionOverwrites.push({
                id: user.id,
                allow: [
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory,
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.AttachFiles,
                    PermissionsBitField.Flags.EmbedLinks,
                ],
            });
        }
    }

    if (guild.id === gameConfig.guildIds.main) {
        permissionOverwrites.push({
            id: gameConfig.roleIds.Spectator,
            allow: [PermissionsBitField.Flags.ViewChannel],
        });
    }

    const newChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: chosenCategory.id,
        permissionOverwrites: permissionOverwrites,
    });

    // add to database where required
    await Season.findByIdAndUpdate("season", {
        $addToSet: {
            temporaryChannels: newChannel.id,
        },
    });

    return newChannel;
}

// returns the channel created and adds the channel id to the game's temporary channel array
async function createLoungeChannel(guild, channelName, loungeType, users) {
    // const allChannels = await guild.channels.fetch();

    let categoryPrefix = null;
    if (loungeType === "monologue") {
        categoryPrefix = gameConfig.monologueCategoryPrefix;
    } else if (loungeType === "lounge") {
        categoryPrefix = gameConfig.loungeCategoryPrefix;
    } else if (loungeType === "groupchat") {
        categoryPrefix = gameConfig.groupchatCategoryPrefix;
    } else if (loungeType === "kidnap") {
        categoryPrefix = gameConfig.kidnapCategoryPrefix;
    }

    const newChannel = await createTemporaryChannel(
        guild,
        channelName,
        categoryPrefix,
        users
    );

    if (loungeType !== "monologue" && loungeType !== "kidnap") {
        await setChannelLoggable(newChannel.id, true);
    }

    return newChannel;
}

// returns the number of lounges + 1
async function getNextLoungeId() {
    const count = await Lounge.countDocuments({});
    return count + 1;
}

// creates a group chat log
async function logGroupChat(client, loungeId, user, members) {
    const time = Math.floor(Date.now() / 1000);
    const channels = client.channels;

    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    const userMember = await mainGuild.members.fetch(user.id);
    const playerData = await getPlayerData(user);

    let logMessage = `Group chat created at <t:${time}> by ${strippedName(
        userMember.displayName
    )} with members:`;

    for (const member of members) {
        const memberUser = await mainGuild.members.fetch(member.id);
        logMessage += `\n${strippedName(memberUser.displayName)}`;
    }

    // regular logs
    if (!playerData.underTheRadar) {
        // watari's logs
        if (await isRoleAlive("Watari")) {
            const watariContactLogs = await channels.fetch(
                gameConfig.channelIds.watariContactLogs
            );
            await watariContactLogs.send(logMessage);
        }
    }

    // host logs
    const hostLogs = await channels.fetch(gameConfig.channelIds.hostLogs);
    await hostLogs.send(logMessage);
}

// creates contact logs for a contact
async function logContact(client, loungeId, user, target, anonymous) {
    const monologue = user.id === target.id;
    const time = Math.floor(Date.now() / 1000);
    const channels = client.channels;

    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    const userMember = await mainGuild.members.fetch(user.id);
    const targetMember = await mainGuild.members.fetch(target.id);

    let playerData = await getPlayerData(user);

    // handle watari and PI anonymous contact log message
    let userDisplay = `**${strippedName(userMember.displayName)}**`;
    let targetDisplay = `**${strippedName(targetMember.displayName)}**`;

    if (playerData.role === "Watari" && anonymous) userDisplay = `@Watari`;

    if (playerData.role === "PI" && anonymous) userDisplay = `@P.I`;

    let logMessage = `${userDisplay} contacted ${targetDisplay} at <t:${time}>`;

    // regular logs
    if (!monologue && !playerData.underTheRadar) {
        // watari's logs
        if (await isRoleAlive("Watari")) {
            const watariContactLogs = await channels.fetch(
                gameConfig.channelIds.watariContactLogs
            );
            await watariContactLogs.send(logMessage);
        }
        // stolen logs
        const stolenContactLogs = await channels.fetch(
            gameConfig.channelIds.stolenContactLogs
        );
        await stolenContactLogs.send(logMessage);
    }

    // host logs
    const hostLogs = await channels.fetch(gameConfig.channelIds.hostLogs);
    const loungeData = await Lounge.findOne({ loungeId: loungeId });

    const loungeChannels = await Promise.all(
        loungeData.channelIds.map((id) => channels.fetch(id))
    );
    for (const loungeChannel of loungeChannels)
        logMessage += ` ${loungeChannel.toString()}`;

    await hostLogs.send(logMessage);
}

// returns a boolean stating whether or not the player can use the anonymous contact ability
async function canAnonContact(user) {
    const playerData = await getPlayerData(user);

    return (
        (playerData.role === "Watari" || playerData.role === "PI") &&
        // !playerData.cooldowns.get("anonymousContact") &&
        playerData.contactTokens >= 2
    );
}

// returns true if can contact, or a string (the contact rejected reason)
async function canContact(user, target, anonymous, groupChat) {
    const playerData = await getPlayerData(user);
    const targetData = await getPlayerData(target);
    const season = await Season.findById("season");
    const monologue = user.id === target.id;

    if (!season) return "The season has not yet begun.";

    if (!playerData) return "You don't have any data yet.";

    if (!targetData) return "You're trying to contact someone who has no data.";

    if (!playerData.alive && !monologue) return "You're dead...";

    if (!targetData.alive && !monologue)
        return "You're trying to talk to a corpse... Lane moment...";

    if (playerData.loungeHideReasons.length > 0 && !monologue)
        return `Cannot contact because you have at least one lounge hiding reason: ${playerData.loungeHideReasons}`;

    if (targetData.loungeHideReasons.length > 0 && !monologue)
        return `Cannot contact because your target has at least one lounge hiding reason: ${targetData.loungeHideReasons}`;

    if (!(await canAnonContact(user)) && anonymous)
        return "You can't use anonymous contact buddy.. Heh...";

    if (anonymous && monologue)
        return "Why would you want to anonymously contact yourself???";

    if (!(playerData.contactTokens > 0) && !monologue && !groupChat)
        return "You're broke buddy.. 0 CONTACT TOKENS!!!";

    return true;
}

// handles the contact mechanic between two users and returns the command reply string
async function contact(client, user, target, anonymous) {
    const monologue = user.id === target.id;
    let playerData = await getPlayerData(user);
    let targetData = await getPlayerData(target);

    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);

    // reject contact early with the rejection message if the user is not allowed to contact
    const allowedToContact = await canContact(user, target, anonymous);
    if (allowedToContact !== true) return allowedToContact;

    if (monologue) {
        // if it is a monologue, and there is already a monologue for this player, then end early and link the monologue channel.
        if (playerData.monologueChannelId) {
            //console.log(playerData.monologueChannelId);
            const monologueChannel = await client.channels.fetch(
                playerData.monologueChannelId
            );
            return `You already have a monologue: ${monologueChannel}`;
        }
        // else, create the channel
        const monologueChannel = await createLoungeChannel(
            mainGuild,
            `${user.username}-monologue`,
            "monologue",
            [user]
        );

        playerData = await updatePlayerData(user, {
            monologueChannelId: monologueChannel.id,
        });

        return `Monologue channel created: ${monologueChannel}`;
    }

    // create the lounge
    // remember, if it is anonymous, there are two channels created, and a cd must be added.
    let channelReturn = null;
    const loungeId = await getNextLoungeId();
    const loungeChannelIds = [];
    // add to the lounge data of both players
    const playerLounges = playerData.loungeChannelIds;
    const targetLounges = targetData.loungeChannelIds;
    if (anonymous) {
        // await addCooldown(user, "anonymousContact", 1);

        channelReturn = await createLoungeChannel(
            mainGuild,
            `lounge-${loungeId}`,
            "lounge",
            [user]
        );
        playerLounges.push(channelReturn.id);

        const channel2 = await createLoungeChannel(
            mainGuild,
            `lounge-${loungeId}`,
            "lounge",
            [target]
        );
        targetLounges.push(channel2.id);

        loungeChannelIds.push(channelReturn.id);
        loungeChannelIds.push(channel2.id);

        if (playerData.role === "Watari")
            await channel2.send(`@Watari ${target}`);

        if (playerData.role === "PI") await channel2.send(`@P.I ${target}`);
    } else {
        channelReturn = await createLoungeChannel(
            mainGuild,
            `lounge-${loungeId}`,
            "lounge",
            [user, target]
        );
        playerLounges.push(channelReturn.id);
        targetLounges.push(channelReturn.id);
        loungeChannelIds.push(channelReturn.id);
    }

    await channelReturn.send(`${user} ${target}`);

    // create the lounge document
    await Lounge.create({
        loungeId: loungeId,
        channelIds: loungeChannelIds,
    });

    playerData = await updatePlayerData(user, {
        loungeChannelIds: playerLounges,
    });
    targetData = await updatePlayerData(target, {
        loungeChannelIds: targetLounges,
    });

    // consume a token
    playerData = await updatePlayerData(user, {
        contactTokens: Math.max(
            0,
            playerData.contactTokens - 1 - (anonymous ? 1 : 0)
        ),
    });

    // log the contact
    await logContact(client, loungeId, user, target, anonymous);

    if (anonymous)
        return `Successfully created anonymous contact lounge: ${channelReturn}`;

    return `Successfully created contact lounge: ${channelReturn}`;
}

async function createGroupChat(client, user, passedTargets) {
    const targets = passedTargets.filter((target) => target !== null);
    const season = await Season.findById("season");
    if (!season) return "The season has not yet begun.";

    const NUMBER_OF_GROUP_CHATS = season.groupChats.length;

    let playerData = await getPlayerData(user);

    for (const groupChat of season.groupChats) {
        if (groupChat.owner === user.id) {
            return `You already own a group chat. Don't be greedy.`;
        }
    }
    if (NUMBER_OF_GROUP_CHATS >= gameConfig.maxGroupChats) {
        return `The maximum number of group chats (${gameConfig.maxGroupChats}) has been reached.`;
    }
    const duplicates = targets.filter(
        (item, index) => targets.indexOf(item) !== index
    );
    if (duplicates.length > 0) {
        return `You cannot create a group chat with duplicate members.`;
    }
    for (const target of targets) {
        if (user.id == target.id) {
            return `You cannot create a group chat with yourself as one of the specified members.`;
        }
        const denialReason = await canContact(user, target, false, true);
        if (denialReason !== true) {
            return `You cannot create a group chat with ${target} because of the reason: (${denialReason})`;
        }
    }

    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    channelReturn = await createLoungeChannel(
        mainGuild,
        `group-chat-${NUMBER_OF_GROUP_CHATS + 1}`,
        "groupchat",
        [user, ...targets]
    );
    for (const target of targets) {
        const targetData = await getPlayerData(target);
        targetData.loungeChannelIds.push(channelReturn.id);
        await updatePlayerData(target, targetData);
    }

    season.groupChats.push({
        owner: user.id,
        members: targets.map((target) => target.id),
        channelId: channelReturn.id,
    });
    await season.save();

    playerData.loungeChannelIds.push(channelReturn.id);
    playerData.contactTokens = Math.max(
        0,
        playerData.contactTokens - gameConfig.dailyTokens
    );
    await updatePlayerData(user, playerData);

    await channelReturn.send(
        `This group chat has been created by ${user}. ${targets.join(" ")}`
    );

    await logGroupChat(client, season.id, user, targets);

    return `Successfully created group chat.`;
}

async function changeGroupChatOwner(client, user, channel, newOwner) {
    const season = await Season.findById("season");
    if (!season) return "The season has not yet begun.";

    let groupChatTable = season.groupChats.find(
        (chat) => chat.channelId === channel.id
    );
    if (!groupChatTable) {
        return "This channel is not a group chat.";
    }
    if (groupChatTable.owner !== user.id) {
        return "You are not the owner of this group chat.";
    }
    if (groupChatTable.owner === newOwner.id) {
        return "You are already the owner of this group chat.";
    }
    if (!groupChatTable.members.includes(newOwner.id)) {
        return "You can't transfer ownership to somebody who not in the group chat.";
    }
    if (season.groupChats.some((chat) => chat.owner === newOwner.id)) {
        return "This user already owns a group chat. You can only own one group chat at a time.";
    }
    const newOwnerData = await getPlayerData(newOwner);
    if (!newOwnerData || !newOwnerData.alive) {
        return "The new owner has to be alive.";
    }

    const oldOwnerId = groupChatTable.owner;
    groupChatTable.owner = newOwner.id;
    groupChatTable.members = groupChatTable.members.filter(
        (id) => id !== newOwner.id
    );
    if (!groupChatTable.members.includes(oldOwnerId)) {
        groupChatTable.members.push(oldOwnerId);
    }

    await season.save();
    await channel.send(
        `The ownership of this group chat has been transferred to ${newOwner}.`
    );

    return `Successfully transferred ownership of the group chat to ${newOwner}.`;
}

async function addUserToGroupChat(client, user, target, channel) {
    const season = await Season.findById("season");
    if (!season) return "The season has not yet begun.";

    const targetData = await getPlayerData(target);

    let groupChatTable = season.groupChats.find(
        (chat) => chat.channelId === channel.id
    );
    if (!groupChatTable) {
        return "This channel is not a group chat.";
    }
    if (groupChatTable.owner !== user.id) {
        return "You are not the owner of this group chat.";
    }
    const denialReason = await canContact(user, target, false, true);
    if (denialReason !== true) {
        return `You cannot add ${target} to the group chat because of the reason: (${denialReason})`;
    }
    if (target.id === user.id) {
        return "You cannot add yourself to the group chat.";
    }
    if (groupChatTable.members.includes(target.id)) {
        return "This user is already a member of the group chat.";
    }
    if (groupChatTable.members.length >= gameConfig.maxGroupChatMembers) {
        return "This group chat is full.";
    }

    groupChatTable.members.push(target.id);
    targetData.loungeChannelIds.push(channel.id);

    await addUsersToChannel([target], channel);

    await season.save();
    await channel.send(`${target} has been added to the group chat`);

    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    const targetMember = await mainGuild.members.fetch(target.id);
    return `Successfully added ${targetMember.displayName} to the group chat`;
}

async function removeUserFromGroupChat(client, user, target, channel) {
    const season = await Season.findById("season");
    if (!season) return "The season has not yet begun.";

    const targetData = await getPlayerData(target);

    let groupChatTable = season.groupChats.find(
        (chat) => chat.channelId === channel.id
    );
    if (!groupChatTable) {
        return "This channel is not a group chat.";
    }
    if (groupChatTable.owner !== user.id) {
        return "You are not the owner of this group chat.";
    }
    if (target.id === user.id) {
        return "You cannot remove yourself from the group chat.";
    }
    if (!groupChatTable.members.includes(target.id)) {
        return "This user is not a member of the group chat.";
    }

    groupChatTable.members = groupChatTable.members.filter(
        (id) => id !== target.id
    );
    targetData.loungeChannelIds = targetData.loungeChannelIds.filter(
        (id) => id !== channel.id
    );

    await removeUsersFromChannel([target], channel);

    await season.save();
    await updatePlayerData(target, targetData);

    await channel.send(`${target} has been removed from the group chat`);

    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    const targetMember = await mainGuild.members.fetch(target.id);
    return `Successfully removed ${targetMember.displayName} from the group chat`;
}

async function changeGroupChatName(client, user, channel, newName) {
    const season = await Season.findById("season");
    if (!season) return "The season has not yet begun.";

    const groupChatTable = season.groupChats.find(
        (chat) => chat.channelId === channel.id
    );
    if (!groupChatTable) {
        return "This channel is not a group chat.";
    }
    if (groupChatTable.owner !== user.id) {
        return "You are not the owner of this group chat.";
    }

    await channel.setName(newName);

    return `Successfully changed the group chat name to ${newName}`;
}

async function createKirasKingdom() {
    await Organisation.create({
        organisation: "Kira's Kingdom",
    });
}

async function createTaskForce() {
    await Organisation.create({
        organisation: "Task Force",
    });
}

// creates the data for the season
async function newSeason() {
    await Season.create({
        temporaryChannels: [],
        messageLoggedChannels: [],
        groupChats: [],
        day: 1,
    });
    await createKirasKingdom();
    await createTaskForce();
}

// any of the killUser functions should only be killed after onPlayerKillPlayer is called. This is to prevent some fuckery with stuff like death note ownership.
async function killUser(
    client,
    user,
    message,
    messageOverride,
    hadNotebook,
    hadBugAbility
) {
    const userData = await getPlayerData(user);

    await updatePlayerData(user, { alive: false, timeOfDeath: Date.now() });
    await hideLounges(client, user, "dead");

    if (!messageOverride)
        await deathMessage(
            client,
            user,
            message,
            userData.trueName,
            userData.role,
            hadNotebook,
            userData.affiliations,
            hadBugAbility
        );

    const allNotebooks = await Notebook.find({});

    // no point in deleting the notebook. it wont be accessible anyway. just kick them out. also, it it's a pseudocide,
    // then they should gain back access to the notebook whenever.
    for (const notebook of allNotebooks) {
        try {
            const guild = await client.guilds.fetch(notebook.guildId);
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (member)
                await member.kick(
                    "Player died. They are to be removed from the notebook."
                );
        } catch (err) {
            console.log(
                "Failed to remove notebook from user after death:",
                err
            );
        }
    }

    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);

    // remove bugs
    await BugLog.deleteMany({ targetId: user.id });

    // roles and nickname
    const member = await mainGuild.members.fetch(user.id).catch(() => null);
    if (member) {
        // no need to await here
        member.roles.add(gameConfig.roleIds.Shinigami);
        member.roles.remove(gameConfig.roleIds.Civilian);
        member.setNickname(strippedName(member.displayName));
    }

    // remove custody and incarceration (in case they were in custody/incarcerated when they died)
    // also release them early from any kidnaps
    await removeCustody(client, user);
    await release(client, user);
    await earlyKidnapRelease(client, user);
}

async function killUserById(client, id, message, messageOverride, hadNotebook) {
    const user = await client.users.fetch(id);
    await killUser(client, user, message, messageOverride, hadNotebook);
}

// sets a player's alive status to false and hides all of their lounges from them
async function kill(interaction) {
    const target = interaction.options.getUser("target");
    const books = await Notebook.find({ currentOwner: target.id });
    const bugs = await BugLog.find({ buggedBy: target.id });
    const message = interaction.options.getString("message");
    await killUser(
        interaction.client,
        target,
        message,
        false,
        books.length > 0,
        bugs.length > 0
    );
}

async function guildIsNotebook(guild) {
    return (await Notebook.findOne({ guildId: guild.id })) !== null;
}

async function onPlayerKillPlayer(client, idKiller, idVictim) {
    // increment kill count of killer
    await Player.updateOne(
        {
            userId: idKiller,
        },
        { $inc: { kills: 1 } }
    );

    // if the player killed themselves, stop here.
    if (idKiller === idVictim) return;

    // handle death note shit
    const notebooksOwnedByVictim = await Notebook.find({
        currentOwner: idVictim,
    });

    for (const notebook of notebooksOwnedByVictim) {
        // if there is a temporary owner (notebook was temporarily passed to someone), then just change the current owner of the notebook.
        // it will be handled automatically on day change.
        // if there is not, pass it immediately to the killer
        if (notebook.temporaryOwner) {
            await Notebook.updateOne(
                {
                    _id: notebook._id,
                },
                { $set: { currentOwner: idKiller } }
            );
        } else {
            await setNotebook(
                client,
                await client.guilds.fetch(notebook.guildId),
                idKiller
            );
        }
    }

    // bug and contact log ability transfers
    const bugs = await BugLog.find({
        source: "bug",
        buggedBy: idVictim,
    });

    // if the victim was Watari, remove the "watari" channel from all the bugs they created.
    const victimData = await Player.findOne({ userId: idVictim });
    if (victimData.role === "Watari") {
        for (const bug of bugs) {
            bug.channelIds.delete("watari");
            await bug.save();
        }
    }

    // if the victim had the bug ability, transfer all of their bugs to the killer.
    for (const bug of bugs) {
        bug.buggedBy = idKiller;
        await bug.save();
    }

    // give killer access to the watari's stolen laptop and revoke access from the victim
    const watariLaptop = await client.channels.fetch(
        gameConfig.guildIds.watarilaptop
    );
    const killerUser = await client.users.fetch(idKiller);
    const victimUser = await client.users.fetch(idVictim);
    await revokeAccess(victimUser, watariLaptop);
    await grantAccess(killerUser, watariLaptop);
}

// if guild is not a notebook yet, this function creates a new notebook and sets the current and original owner to owner.
// if guild is already a notebook, the notebook's current owner is updated to the next owner.
// grants and revokes guild access as necessary.
// if temporary is true, then instead of current owner being changed, temporary owner is changed. notebooks with temporary owners
// are sent back to their current owners when the next day begins.
async function setNotebook(client, guild, ownerid, temporary) {
    const existingBook = await Notebook.findOne({ guildId: guild.id });

    if (existingBook) {
        const currentHolder =
            existingBook.temporaryOwner ?? existingBook.currentOwner;
        const newHolder = ownerid;

        const currentHolderUser = await client.users.fetch(currentHolder);
        const newHolderUser = await client.users.fetch(newHolder);

        // if the current holder and new holder are the same, do nothing
        if (currentHolder === newHolder) return;

        // if temporary, change the temporary owner field, otherwise, change current owner
        if (temporary) {
            await Notebook.findOneAndUpdate(
                { _id: existingBook._id },
                { $set: { temporaryOwner: ownerid } }
            );
        } else {
            if (existingBook.currentOwner !== ownerid)
                await Notebook.findOneAndUpdate(
                    { _id: existingBook._id },
                    { $set: { currentOwner: ownerid } }
                );
        }

        // if the person holding the notebook, changed, revoke access from the old and grant to the new.
        if (newHolder !== currentHolder) {
            await revokeAccess(currentHolderUser, guild);
            await grantAccess(newHolderUser, guild);
        }

        // if the notebook was being held temporarily before the posession change, then remove the temporary owner field
        if (existingBook.temporaryOwner && !temporary) {
            await Notebook.findOneAndUpdate(
                { _id: existingBook._id },
                { $unset: { temporaryOwner: "" } }
            );
        }

        return;
    }

    await Notebook.create({
        guildId: guild.id,
        usedToday: [],
        currentOwner: ownerid,
        originalOwner: ownerid,
    });

    const ownerUser = await client.users.fetch(ownerid);
    await grantAccess(ownerUser, guild);
}

async function handlePlayerKill(client, killerId, targetId, message) {
    const targetData = await Player.findOne({ userId: targetId });

    if (!targetData) return;

    if (!targetData.ipp) {
        const targetNotebooks = await Notebook.find({ currentOwner: targetId });
        const targetBugs = await BugLog.find({ targetId: targetId });
        await onPlayerKillPlayer(client, killerId, targetId);
        await killUserById(
            client,
            targetId,
            message,
            false,
            targetNotebooks.length > 0,
            targetBugs.length > 0
        );
    }
}

async function onScheduledKill(client, delayedAction) {}

async function prepareScheduledDeath(client, targetId) {
    try {
        const delayedDeath = await ScheduledDeath.findOne({
            target: targetId,
        });

        setTimeout(async () => {
            const writtenBy = await client.users.fetch(delayedDeath.writtenBy);

            await handlePlayerKill(
                client,
                writtenBy.id,
                targetId,
                delayedDeath.deathMessage
            );

            await ScheduledDeath.deleteOne({ _id: delayedDeath._id });
        }, Math.max(0, delayedDeath.time - Date.now()));
    } catch (err) {
        console.log(`Scheduled death for ${targetId} failed. Reason: ${err}`);
    }
}

async function onPseudocideRevival(client, targetId, role) {
    const news = await client.channels.fetch(gameConfig.channelIds.news);
    const targetUser = await client.users.fetch(targetId);

    await news.send({
        content: `@everyone It appears that ${targetUser} never actually died! Their death was orchestrated using an ultra-realistic doll.`,
        allowedMentions: { parse: ["everyone"] },
    });

    await role(client, targetUser, role);
}

async function scheduleDeath(client, fromId, targetId, delay, message) {
    await ScheduledDeath.create({
        target: targetId,
        writtenBy: fromId,
        time: Date.now() + delay,
        deathMessage: message,
    });

    await prepareScheduledDeath(client, targetId);
}

async function resetNotebookCooldowns() {
    await Notebook.updateMany(
        {},
        { $set: { usedToday: [], attemptsToday: {} } }
    );
}

async function unlock2ndKira() {
    await Player.updateOne(
        {
            role: "2nd Kira",
        },
        { $set: { unlocked: true } }
    );
}

// handles writing someone's name in a notebook. returns true if the write was a success, failure reason otherwise.
// also handles notebook restrictions for important roles
async function writeName(interaction) {
    if (!(await Season.findOne({}))) return "The season has not yet begun.";

    const guild = interaction.guild;
    const user = interaction.user;
    const name = rawName(interaction.options.getString("name"));
    const delay = interaction.options.getNumber("delay");
    const message = interaction.options.getString("message");
    const userData = await getPlayerData(user);

    if (!userData) return "You do not have any game data.";

    if (userData.notebookRestrictReasons.length > 0)
        return "You cannot use your notebook right now.";

    if (!(await guildIsNotebook(guild)))
        return "This channel is not a notebook.";

    const notebookData = await Notebook.findOne({ guildId: guild.id });
    if (!notebookData) return "Notebook data not found for this channel.";

    const targetData = await Player.findOne({
        trueName: name,
    });

    // handle kira restrictions (alumina)
    // if (userData.role === "Kira" && notebookData.originalOwner === user.id) {
    //     // schedule ability
    //     if (delay && userData.kills < 2)
    //         return "You have not unlocked the schedule ability yet. You need to have killed at least 2 people.";

    //     // creative deaths ability
    //     if (message && userData.kills < 1)
    //         return "You have not unlocked the creative deaths ability yet. You need to have killed at least 1 person.";
    // }

    // 2nd kira restrictions
    if (
        userData.role === "2nd Kira" &&
        notebookData.originalOwner === user.id
    ) {
        if (!userData.unlocked)
            return "You must connect with Kira before you can use your notebook.";
    }

    let attemptsRemaining = notebookData.attemptsToday.get(user.id) ?? 3;

    if (attemptsRemaining === 0)
        return "You have 0 attempts remaining. Try again tomorrow.";

    if (!targetData || targetData.alive === false) {
        const newAttempts = Math.max(attemptsRemaining - 1, 0);
        await Notebook.updateOne(
            { _id: notebookData._id },
            { $set: { [`attemptsToday.${user.id}`]: newAttempts } }
        );
        return `This true name does not refer to anyone. You have ${newAttempts} attempt(s) remaining today.`;
    }

    if (notebookData.usedToday.includes(user.id))
        return "You have already used this notebook to kill someone today.";

    await Notebook.updateOne(
        { _id: notebookData._id },
        { $push: { usedToday: user.id } }
    );

    if (await ScheduledDeath.findOne({ target: targetData.userId })) {
        await ScheduledDeath.deleteOne({
            target: targetData.userId,
        });
        return `This person is already scheduled to die.`;
    }

    try {
        // if scheduled, increase kill count when it goes through, otherwise, increase immediately
        if (delay !== null) {
            await scheduleDeath(
                interaction.client,
                user.id,
                targetData.userId,
                delay * 60_000,
                message
            );
        } else {
            await handlePlayerKill(
                interaction.client,
                user.id,
                targetData.userId,
                message
            );
        }
    } catch (err) {
        return `Failed to fetch target user for kill. Reason: ${err}`;
    }

    return true;
}

async function loadScheduledDeaths(client) {
    const allScheduledDeaths = await ScheduledDeath.find({});

    await Promise.all(
        allScheduledDeaths.map((death) =>
            prepareScheduledDeath(client, death.target)
        )
    );
}

// later, remove the channel ids from player data and such
async function clearTemporaryChannels(client) {
    const season = await Season.findOne({});
    if (!season) return;

    for (const channelId of season.temporaryChannels) {
        try {
            const channel = await client.channels.fetch(channelId);
            if (channel) await channel.delete();
        } catch (err) {
            console.warn(`Could not delete channel ${channelId}:`, err.message);
        }
    }

    season.temporaryChannels = [];
    await season.save();
}

// cleans all game data
// should remove everyone from death note servers
async function cleanSlate(client) {
    await nextDay(client);
    // must be called after nextDay. should not await. it is better if these are done concurrently.
    await clearContactLogs(client.channels);
    await clearTemporaryChannels(client);
    // must be called last
    await resetDatabase();
}

async function underTheRadar(interaction) {
    const user = interaction.user;

    const genericUseResult = await genericUseAbility(
        interaction.client,
        user.id,
        "underTheRadar"
    );
    if (genericUseResult !== true) return genericUseResult;

    await Player.findOneAndUpdate(
        { userId: user.id },
        { $set: { underTheRadar: true } }
    );

    return true;
}

// decreases all cooldown counters by 1
async function progressCooldowns() {
    const players = await Player.find({});
    const organisations = await Organisation.find({});

    for (const player of players) {
        for (const [ability, cooldown] of player.cooldowns) {
            // Ensure cooldown doesn't go below 0
            const newCooldown = Math.max(0, cooldown - 1);
            player.cooldowns.set(ability, newCooldown);
        }
        await player.save();
    }

    for (const organisation of organisations) {
        for (const [ability, cooldown] of organisation.cooldowns) {
            // Ensure cooldown doesn't go below 0
            const newCooldown = Math.max(0, cooldown - 1);
            organisation.cooldowns.set(ability, newCooldown);
        }
        await organisation.save();
    }

    // ability cooldowns
    await Ability.updateMany(
        { cooldown: { $gt: 0 } },
        { $inc: { cooldown: -1 } }
    );
}

// returns all notebooks to their current owners
async function returnNotebooks(client) {
    const temporaryOwnedNotebooks = await Notebook.find({
        temporaryOwner: { $exists: true },
    });

    await Promise.all(
        temporaryOwnedNotebooks.map(async (notebook) => {
            try {
                await setNotebook(
                    client,
                    await client.guilds.fetch(notebook.guildId),
                    notebook.currentOwner
                );
            } catch (err) {
                console.log("Failed to return notebook:", err);
            }
        })
    );
}

// simulates a user passing a notebook to somebody else.
async function passNotebook(client, guild, fromId, toId) {
    if (!(await Season.findOne({}))) return "The season has not yet begun.";

    if (fromId === toId) return "You can't pass a notebook to yourself.";

    const notebook = await Notebook.findOne({ guildId: guild.id });
    const fromData = await Player.findOne({ userId: fromId });
    const toData = await Player.findOne({ userId: toId });

    if (!fromData) return "You do not have any data.";
    if (!toData) return "Target has no data.";
    if (!toData) return "This person is dead.";
    if (!fromData.alive) return "You are dead.";
    if (!(await guildIsNotebook(guild))) return "This is not a notebook.";
    if (fromId !== notebook.currentOwner) return "You don't own this notebook.";
    if (fromData.notebookRestrictReasons.length > 0)
        return "You cannot pass your notebook right now.";

    // later check for restrictions like incarceration

    await setNotebook(client, guild, toId, true);

    return true;
}

async function disableIPPs(mainGuild) {
    const ippPlayers = await Player.find({ ipp: true });
    await Player.updateMany({ ipp: true }, { ipp: false });
    const updates = ippPlayers.map((player) => async () => {
        try {
            const member = await mainGuild.members.fetch(player.userId);

            if (
                mainGuild.members.me.roles.highest.position <=
                    member.roles.highest.position ||
                member.id === mainGuild.ownerId
            )
                return;

            const newNick =
                member.nickname?.replace(/\s*\(IPP\)$/, "") ||
                member.user.username.replace(/\s*\(IPP\)$/, "");

            if (newNick !== member.nickname) {
                await member.setNickname(newNick);
            }
        } catch (err) {
            console.error(`Failed to update ${player.userId}:`, err.message);
        }
    });
    // Run with small delay between requests
    for (const update of updates) {
        await update();
        await new Promise((res) => setTimeout(res, 1000)); // 1s delay per update
    }
}

async function removeWatariBugs(guild) {
    const bugLogs = await BugLog.find({
        source: "bug",
    });
    const buggedPlayers = [];

    for (const log of bugLogs) {
        const player = await Player.findOne({ userId: log.targetId });
        if (player && !buggedPlayers.find((p) => p.userId === player.userId))
            buggedPlayers.push(player);
    }

    await BugLog.deleteMany({ source: "bug" });

    // remove asterisks
    for (const player of buggedPlayers) {
        try {
            const member = await guild.members
                .fetch(player.userId)
                .catch(() => null);
            if (!member) continue;

            const cleanName = member.displayName.replace(/\*/g, "");
            await member.setNickname(cleanName);
        } catch (err) {
            console.warn(
                `Failed to reset nickname for ${player.userId}:`,
                err.message
            );
        }
    }
}

async function resetTokens() {
    await Player.updateMany(
        {},
        { $set: { contactTokens: gameConfig.dailyTokens } }
    );
}

// handles day transition logic
async function nextDay(client) {
    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    await resetTokens();
    await returnNotebooks(client);
    await progressCooldowns();
    await applyAbilityCooldowns();
    await Player.updateMany({ underTheRadar: true }, { underTheRadar: false });
    await removeWatariBugs(mainGuild);
    await disableIPPs(mainGuild);
    await resetNotebookCooldowns();
    await Season.updateOne(
        { _id: "season" },
        {
            $inc: { day: 1 },
        }
    );
}

// closes a lounge for a user
async function closeLounge(user, loungeChannel) {
    const playerData = await getPlayerData(user);

    await updatePlayerData(user, {
        loungeChannelIds: playerData.loungeChannelIds.filter((value) => {
            return value !== loungeChannel.id;
        }),
    });

    await loungeChannel.permissionOverwrites.edit(user.id, {
        ViewChannel: false,
    });
}

async function clearChannel(channel) {
    let fetched;

    do {
        fetched = await channel.messages.fetch({ limit: 100 });

        for (const message of fetched.values()) {
            try {
                await message.delete();
            } catch (err) {
                if (err.code === 10008) {
                    continue;
                } else {
                    console.error(
                        `Failed to delete message ${message.id}:`,
                        err
                    );
                }
            }
        }

        await new Promise((res) => setTimeout(res, 200));
    } while (fetched.size > 0);

    console.log(`Channel ${channel.name} cleared!`);
}

async function clearContactLogs(channels) {
    await clearChannel(
        await channels.fetch(gameConfig.channelIds.watariContactLogs)
    );
    await clearChannel(await channels.fetch(gameConfig.channelIds.hostLogs));
}

async function pseudocide(interaction) {
    const user = interaction.user;
    const target = interaction.options.getUser("target");
    const role = interaction.options.getString("role");
    const trueName = interaction.options.getString("truename");
    const message = interaction.options.getString("deathmessage");
    const hasNotebook = interaction.options.getBoolean("hasnotebook");
    const hasBugAbility = interaction.options.getBoolean("hasbugability");
    const affiliationsString = interaction.options.getString("affiliations");

    let affiliations = [];
    if (affiliationsString) affiliations = affiliationsString.split(", ");

    // pseudocide specific checks
    const targetData = await Player.findOne({ userId: target.id });
    if (!targetData) return "This user has no data.";
    if (!targetData.alive) return "This user is dead.";
    if (targetData.ipp) return "This user is under IPP.";

    // generic role ability checks + usage
    const genericUseResult = await genericUseAbility(
        interaction.client,
        user.id,
        "pseudocide"
    );
    if (genericUseResult !== true) return genericUseResult;

    // continue with pseudocide specific logic
    await killUser(interaction.client, target, null, true);
    await deathMessage(
        interaction.client,
        target,
        message,
        trueName,
        role,
        hasNotebook,
        affiliations,
        hasBugAbility
    );

    await createDelayedAction(
        interaction.client,
        "onPseudocideRevival",
        hrsToMs(24),
        [target.id, targetData.role]
    );

    return true;
}

async function ipp(interaction) {
    const user = interaction.user;
    const target = interaction.options.getUser("target");

    const targetData = await Player.findOne({ userId: target.id });
    if (!targetData) return "This user has no data.";
    if (!targetData.alive) return "This user is dead.";
    if (targetData.ipp) return "This user is already under IPP.";

    const mainGuild = await interaction.client.guilds.fetch(
        gameConfig.guildIds.main
    );
    const targetMember = await mainGuild.members
        .fetch(target.id)
        .catch(() => null);
    if (!targetMember) return "Target is not in the main Discord server.";

    const result = await genericUseAbility(interaction.client, user.id, "ipp");
    if (result !== true) return result;

    await updatePlayerData(target, {
        ipp: true,
    });
    await targetMember.setNickname(`${targetMember.displayName} (IPP)`);

    return true;
}

async function addAffiliation(user, affiliation) {
    const userData = await getPlayerData(user);

    if (!userData) return "This user has no data.";
    if (userData.affiliations.includes(affiliation))
        return "User already has this affiliation.";

    userData.affiliations.push(affiliation);
    await userData.save();

    return true;
}

async function removeAffiliation(user, affiliation) {
    const userData = await getPlayerData(user);

    if (!userData) return "This user has no data.";
    if (!userData.affiliations.includes(affiliation))
        return "User does not have this affiliation.";

    userData.affiliations = userData.affiliations.filter(
        (aff) => aff !== affiliation
    );
    await userData.save();

    return true;
}

async function restrictNotebooks(user, reason) {
    const userData = await getPlayerData(user);

    if (!userData) return "This user has no data.";
    if (userData.notebookRestrictReasons.includes(reason))
        return "User's notebook is already blocked by this.";

    userData.notebookRestrictReasons.push(reason);
    await userData.save();

    return true;
}

async function freeNotebooks(user, reason) {
    const userData = await getPlayerData(user);

    if (!userData) return "This user has no data.";
    if (!userData.notebookRestrictReasons.includes(reason))
        return "User's notebook is not restricted by this reason.";

    userData.notebookRestrictReasons.filter((blocker) => blocker !== reason);
    await userData.save();

    return true;
}

async function incarcerate(client, user) {
    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    const member = await mainGuild.members.fetch(user.id).catch(() => null);
    if (member) {
        await member.roles.add(gameConfig.roleIds.Arrested);
        await member.roles.remove(gameConfig.roleIds.Civilian);
    }

    await hideLounges(client, user, "incarcerated");
    await restrictNotebooks(user, "incarcerated");
}

async function release(client, user) {
    const userData = await Player.findOne({ userId: user.id });
    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    const member = await mainGuild.members.fetch(user.id).catch(() => null);
    if (member) {
        await member.roles.remove(gameConfig.roleIds.Arrested).catch(() => {});
        if (userData.alive)
            await member.roles.add(gameConfig.roleIds.Civilian).catch(() => {});
    }

    await unhideLounges(client, user, "incarcerated");
    await freeNotebooks(user, "incarcerated");
}

async function announce(client, message) {
    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    const news = await mainGuild.channels.fetch(gameConfig.channelIds.news);
    await news.send(message);
}

async function setChannelLoggable(channelId, toggle) {
    const season = await Season.findOne({});

    if (!season) return "No season is currently active.";

    if (toggle) {
        if (!season.messageLoggedChannels.includes(channelId)) {
            season.messageLoggedChannels.push(channelId);
        }
    } else {
        season.messageLoggedChannels = season.messageLoggedChannels.filter(
            (id) => {
                return id !== channelId;
            }
        );
    }

    await season.save();

    return true;
}

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

async function bugUser(client, buggedBy, user, source) {
    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    const lwatariGuild = await client.guilds.fetch(gameConfig.guildIds.lwatari);
    const stolenGuild = await client.guilds.fetch(
        gameConfig.guildIds.watarilaptop
    );
    const member = await mainGuild.members.fetch(user.id).catch(() => null);

    const channelName = `${source}-${strippedName(
        member ? strippedName(member.displayName) : user.username
    )}`;

    const newLog = await BugLog.create({
        buggedBy: buggedBy.id,
        source: source,
        targetId: user.id,
    });

    const logChannelWatari = await createTemporaryChannel(
        lwatariGuild,
        channelName,
        gameConfig.bugLogCategoryPrefix,
        "everyone"
    );
    if (source === "bug") {
        const logChannelStolen = await createTemporaryChannel(
            stolenGuild,
            channelName,
            gameConfig.stolenBugLogCategoryPrefix,
            "everyone"
        );
        newLog.channelIds.set("stolen", logChannelStolen.id);
    }
    newLog.channelIds.set("watari", logChannelWatari.id);
    await newLog.save();

    let notifierMessage = (() => {
        if (source === "bug") return `You have been bugged.`;
        if (source === "custody") return `You have been placed into custody.`;
        return "";
    })();
    let viewableBy = (() => {
        if (source === "bug") return "the person who bugged you";
        if (source === "custody") return "L and Watari";
        return "";
    })();
    notifierMessage += `\nAs a result, anything you send in shared channels will be viewable by ${viewableBy}.
    \nA shared channel is any channel which is not solely visible to you at all times.`;

    try {
        await user.send(notifierMessage);
    } catch (err) {
        console.log("Failed to notify user of bug.", err);
    }
}

async function bug(interaction) {
    const user = interaction.user;
    const target = interaction.options.getUser("target");
    const targetData = await Player.findOne({ userId: target.id });

    if (!targetData) return "This user has no data.";
    if (!targetData.alive) return "This user is dead.";

    const genericUseResult = await genericUseAbility(
        interaction.client,
        user.id,
        "bug"
    );
    if (genericUseResult !== true) return genericUseResult;

    const mainGuild = await interaction.client.guilds.fetch(
        gameConfig.guildIds.main
    );
    const targetMember = await mainGuild.members
        .fetch(target.id)
        .catch(() => null);

    await bugUser(interaction.client, interaction.user, target, "bug");

    // function to insert '*' before any parenthetical suffix (chatgpt generated)
    function addBugAsterisk(displayName) {
        if (displayName.includes("*")) return displayName; // prevent double asterisk
        const match = displayName.match(/\s\([^)]+\)$/);
        if (match) {
            return displayName.replace(match[0], `*${match[0]}`);
        } else {
            return displayName + "*";
        }
    }

    if (targetMember) {
        const newNickname = addBugAsterisk(targetMember.displayName);
        await targetMember.setNickname(newNickname);
    }

    return true;
}

async function fetchAllMessages(
    channel,
    earliestTimestamp,
    predicate = () => true
) {
    let allMessages = [];
    let lastId;
    let done = false;

    while (!done) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const messages = await channel.messages.fetch(options);
        if (messages.size === 0) break;

        for (const msg of messages.values()) {
            if (msg.createdTimestamp < earliestTimestamp) {
                done = true; // all remaining messages are too old
                break;
            }
            if (predicate(msg)) allMessages.push(msg);
        }

        lastId = messages.last().id;
    }

    return allMessages;
}

// ILL SAVE THE DAY ALBINOHORROR! Now: combines msgs into blocks to save api calls
// Fixed embed stuff
// Fixed cut off stuff
async function autopsy(interaction) {
    const user = interaction.user;
    const target = interaction.options.getUser("target");
    const targetData = await Player.findOne({ userId: target.id });
    const season = await Season.findOne({});

    if (!targetData) return "This user has no data.";
    // if (targetData.alive) return "This user is not dead.";

    const genericUseResult = await genericUseAbility(
        interaction.client,
        user.id,
        "autopsy"
    );
    if (genericUseResult !== true) return genericUseResult;

    const timeOfDeath = targetData.timeOfDeath;
    const autopsyLogs = await interaction.client.channels.fetch(
        gameConfig.channelIds.autopsyLogs
    );

    // fetch all messages after and including earliest
    const earliest = timeOfDeath - hrsToMs(3);
    const allMessagesArrays = await Promise.all(
        season.messageLoggedChannels.map(async (channelId) => {
            const channel = await interaction.client.channels
                .fetch(channelId)
                .catch(() => null);
            if (!channel) return [];
            return fetchAllMessages(
                channel,
                earliest,
                (msg) => msg.author.id === target.id
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
        content: `Autopsy logs for ${target}:`,
    });
    await beginMessage.pin().catch(console.error);
    await autopsyLogs.send({
        content:
            "==========================<START OF AUTOPSY>==========================",
    });

    await new Promise((res) => setTimeout(res, 5000));

    // Send a block as chunks, ensuring no message is split
    async function sendBlock(blockLines) {
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

    return true;
}

// the ability
async function anonymousAnnouncement(interaction) {
    const message = interaction.options.getString("message");

    const genericUseResult = await genericUseAbility(
        interaction.client,
        interaction.user.id,
        "anonymousMessage"
    );
    if (genericUseResult !== true) return genericUseResult;

    await announce(interaction.client, `@everyone **???:** "${message}"`);

    return true;
}

async function startBlackout(client) {
    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    const newsChannel = await mainGuild.channels.fetch(
        gameConfig.channelIds.news
    );
    await newsChannel.permissionOverwrites.edit(gameConfig.roleIds.Civilian, {
        ViewChannel: false,
    });
}

async function stopBlackout(client) {
    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    const newsChannel = await mainGuild.channels.fetch(
        gameConfig.channelIds.news
    );
    await newsChannel.permissionOverwrites.edit(gameConfig.roleIds.Civilian, {
        ViewChannel: true,
    });

    await newsChannel.send({
        content: `@everyone The local network seems to be back up... The blackout has ended!`,
    });
}

async function delayedRelease(client, targetId) {
    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    const newsChannel = await mainGuild.channels.fetch(
        gameConfig.channelIds.news
    );
    const target = await mainGuild.members.fetch(targetId);
    await newsChannel.send({
        content: `@everyone It appears that the <@&${gameConfig.roleIds["Task Force"]}> have finally released **${target.displayName}**. Lets hope they don't return to their old ways.`,
    });

    // check if they are still arrested, if they are, release them. this can still potentially lead to bugs, but right now pseudocide lasts 24 hours, so it should be fine.
    if (await target.roles.fetch(gameConfig.roleIds.Arrested)) {
        await release(client, target);
    }
}

const filter = (reaction, user) => {
    return ["👍", "👎"].includes(reaction.emoji.name) && !user.bot;
};
async function createGenericPoll(
    message,
    duration,
    majorityToWin,
    participationRequirementCallback,
    callback
) {
    const collector = message.createReactionCollector({
        filter,
        time: duration,
    });

    await message.react("👍");
    await message.react("👎");

    let upvotes = 0;
    let downvotes = 0;
    const votedUsers = new Set();

    collector.on("collect", (reaction, user) => {
        if (votedUsers.has(user.id)) {
            // Prevent double voting for different options
            const userReactions = message.reactions.cache.filter((r) =>
                r.users.cache.has(user.id)
            );
            // If user already voted for 👍 and now tries 👎, deny 👎
            if (
                reaction.emoji.name === "👎" &&
                userReactions.some((r) => r.emoji.name === "👍")
            ) {
                reaction.users.remove(user.id);
                return;
            }
            // If user already voted for 👎 and now tries 👍, deny 👍
            if (
                reaction.emoji.name === "👍" &&
                userReactions.some((r) => r.emoji.name === "👎")
            ) {
                reaction.users.remove(user.id);
                return;
            }
            return;
        }
        if (!participationRequirementCallback(user)) {
            reaction.users.remove(user.id);
            return;
        }
        votedUsers.add(user.id);

        if (reaction.emoji.name === "👍") upvotes++;
        if (reaction.emoji.name === "👎") downvotes++;

        if (
            typeof majorityToWin === "number" &&
            (upvotes >= majorityToWin || downvotes >= majorityToWin)
        ) {
            collector.stop();
        }
    });

    collector.on("end", () => {
        let result;
        if (upvotes > downvotes) {
            result = "win";
        } else if (downvotes > upvotes) {
            result = "loss";
        } else {
            result = "tie";
        }
        callback(result);
    });
}

// removes ipp and bug tag (* and (IPP))
function strippedName(name) {
    return name.replace(/\*/g, "").replace(/\s*\(IPP\)$/, "");
}

// if no kidnapper id, then it was an anonymous kidnapping
// when kidnap is over, delete the kidnap channel using deleteTemporaryChannel as well as the kidnap db entry.
async function kidnap(client, kidnapperGuild, targetId, kidnapperId) {
    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    const victimUser = await client.users.fetch(targetId).catch(() => null);
    const victimMember = await mainGuild.members
        .fetch(targetId)
        .catch(() => null);
    if (!victimMember || !victimUser)
        return "Target is not in the main Discord server.";
    const existingVictimKidnap = await KidnapLounge.findOne({
        victimId: targetId,
    });
    if (existingVictimKidnap) return "This user is already kidnapped.";
    const victimData = await Player.findOne({ userId: targetId });
    if (victimData.ipp) return "This user is under IPP.";

    const victimName = strippedName(victimMember.displayName);
    const typeString = kidnapperId ? "public" : "anonymous";

    const kidnapVictimChannel = await createLoungeChannel(
        mainGuild,
        `kidnapped-${victimName}`,
        "kidnap",
        [targetId]
    );
    const kidnapperChannel = await createLoungeChannel(
        kidnapperGuild,
        `${victimName}-${typeString}`,
        "kidnap",
        "everyone"
    );

    // kidnap effects
    await hideLounges(client, victimUser, "kidnapped");
    await restrictNotebooks(victimUser, "kidnapped");
    // Add kidnapped role and remove civ role
    try {
        await victimMember.roles.add(gameConfig.roleIds.Kidnapped);
        await victimMember.roles.remove(gameConfig.roleIds.Civilian);
    } catch (err) {
        console.log("Failed to update roles for kidnapped member:", err);
    }

    const kidnapDoc = await KidnapLounge.create({
        victimId: targetId,
        kidnapperId: kidnapperId,
        kidnapperChannelId: kidnapperChannel.id,
        kidnappedChannelId: kidnapVictimChannel.id,
    });

    const actionId = await createDelayedAction(
        client,
        "kidnapRelease",
        hrsToMs(gameConfig.HRS_KIDNAP_DURATION),
        [kidnapDoc._id]
    );

    kidnapDoc.actionId = actionId;
    await kidnapDoc.save();

    await kidnapperChannel.send({
        content: `Here you can talk to your captive. All messages sent here will be relayed to them in another channel. @everyone`,
    });
    await kidnapVictimChannel.send({
        content: `Here you can talk to your kidnappers. All messages sent here will be relayed to them in another channel. @everyone`,
    });

    return true;
}

async function earlyKidnapRelease(client, kidnapDoc) {
    await executeDelayedActionEarly(client, kidnapDoc.actionId);
}

async function kidnapRelease(client, kidnapDocId) {
    const kidnapDoc = await KidnapLounge.findById(kidnapDocId);
    if (!kidnapDoc) return;

    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    const news = await mainGuild.channels.fetch(gameConfig.channelIds.news);
    const kidnappedUser = await client.users
        .fetch(kidnapDoc.victimId)
        .catch(() => null);
    const kidnappedMember = await mainGuild.members
        .fetch(kidnapDoc.victimId)
        .catch(() => null);
    const kidnappedUserData = await Player.findOne({
        userId: kidnapDoc.victimId,
    });

    // Remove kidnapped effects
    await unhideLounges(client, kidnappedUser, "kidnapped");
    await freeNotebooks(kidnappedUser, "kidnapped");

    // Add civ role (if alive) and remove kidnapped role
    try {
        if (kidnappedUserData.alive) {
            await kidnappedMember.roles.add(gameConfig.roleIds.Civilian);
        }
        await kidnappedMember.roles.remove(gameConfig.roleIds.Kidnapped);
    } catch (err) {
        console.log("Failed to update roles for kidnapped member:", err);
    }

    // Send notifiers (if alive)
    if (kidnappedUserData.alive) {
        const revealString = kidnapDoc.kidnapperId
            ? `When questioned by authorities, ${kidnappedUser} recalled the identity of their kidnapper: ${await client.users.fetch(
                  kidnapDoc.kidnapperId
              )}`
            : "";
        await news.send(
            `@everyone ${kidnappedUser} has been released from captivity. They have now returned to their normal life.\n${revealString}`
        );
    }

    // Remove perms from kidnapped channel
    const kidnapVictimChannel = await client.channels.fetch(
        kidnapDoc.kidnappedChannelId
    );
    await kidnapVictimChannel.permissionOverwrites.delete(kidnappedUser);

    // Delete the kidnap document
    await KidnapLounge.deleteOne({ _id: kidnapDocId });
}

async function nameReveal(interaction) {
    const target = interaction.options.getUser("target");
    const user = interaction.user;
    const targetData = await Player.findOne({ userId: target.id });
    const userData = await Player.findOne({ userId: user.id });

    if (!targetData) return "This player has no data.";
    if (!targetData.alive) return "This player is dead.";
    if (userData.role === "BB" && userData.eyes <= 0)
        return "You no longer possess shinigami eyes.";

    const genericUseResult = await genericUseAbility(
        interaction.client,
        interaction.user.id,
        "nameReveal"
    );
    if (genericUseResult !== true) return genericUseResult;

    // apply cooldowns for the other ability
    await genericUseAbility(null, user.id, "notebookDetect");

    await interaction.user.send(
        `The true name of ${target} is **${targetData.trueName}**.`
    );

    return true;
}

async function notebookReveal(interaction) {
    const target = interaction.options.getUser("target");
    const user = interaction.user;
    const targetData = await Player.findOne({ userId: target.id });
    const userData = await Player.findOne({ userId: user.id });

    if (!targetData) return "This player has no data.";
    if (!targetData.alive) return "This player is dead.";
    if (userData.role === "BB" && userData.eyes <= 0)
        return "You no longer possess shinigami eyes.";

    const genericUseResult = await genericUseAbility(
        interaction.client,
        user.id,
        "notebookDetect"
    );
    if (genericUseResult !== true) return genericUseResult;

    // apply cooldowns for the other ability
    await genericUseAbility(null, user.id, "nameReveal");
    await genericUseAbility(null, user.id, "nameReveal");

    // need to check if the target is currently holding a notebook. for all notebooks which they are the currentOwner of,
    // check if there is a temporary owner. if there is a temporary owner, they do not hold that notebook.
    // also, if the target is the temporary owner of any notebook, then they currently hold a notebook.
    const temporaryOwner = await Notebook.findOne({
        temporaryOwner: target.id,
    });

    let notebooksNotPassed = 0;
    const notebooksOwned = await Notebook.find({ currentOwner: target.id });
    for (const notebook of notebooksOwned) {
        // if temporary owner, target does not hold this notebook
        if (notebook.temporaryOwner) {
            continue;
        }
        // else, they do hold the notebook
        notebooksNotPassed++;
    }

    if (temporaryOwner || notebooksNotPassed > 0) {
        await interaction.user.send(
            `${target} currently possesses a notebook.`
        );
    } else {
        if (userData.role === "BB")
            await Player.updateOne({ userId: user.id }, { $inc: { eyes: -1 } });
        await interaction.user.send(
            `${target} does not currently possess a notebook.`
        );
    }

    return true;
}

async function eyes(interaction) {
    const useFor = interaction.options.getString("usefor");

    let result = true;
    if (useFor === "name") {
        result = await nameReveal(interaction);
    } else if (useFor === "notebook") {
        result = await notebookReveal(interaction);
    }

    return result;
}

// Used by News Anchor
async function civilianArrest(interaction) {
    const target = interaction.options.getUser("target");

    const mainGuild = await interaction.client.guilds.fetch(
        gameConfig.guildIds.main
    );
    const news = await mainGuild.channels.fetch(gameConfig.channelIds.news);
    const member = await mainGuild.members.fetch(interaction.user.id);
    const targetMember = await mainGuild.members.fetch(target.id);

    const playerData = await getPlayerData(interaction.user);
    const targetData = await getPlayerData(target);

    if (interaction.channel.name !== "news") {
        return "You can only start a civilian arrest in the news channel.";
    }
    if (!targetData || !targetData.alive) {
        return "The target must be alive.";
    }
    if (
        targetMember.roles.cache.some(
            (r) =>
                r.id === gameConfig.roleIds.Arrested ||
                r.id === gameConfig.roleIds.Kidnapped
        )
    ) {
        return "You cannot start a civilian arrest on someone that is already locked up.";
    }
    if (targetData.ipp) return "You cannot start a civilian arrest on someone that is under IPP.";

    const genericUseResult = await genericUseAbility(
        interaction.client,
        interaction.user.id,
        "civilianArrest"
    );
    if (genericUseResult !== true) return genericUseResult;

    const civArrestMsg = await news.send({
        content: `@everyone The <@&${
            gameConfig.roleIds["News Anchor"]
        }> has started a civilian arrest on **${strippedName(
            target.displayName
        )}**. Vote 👍 if you would like this person to be arrested for ${
            gameConfig.HRS_ARREST_DURATION
        } hours. Vote 👎 if you do not want this person to be arrested. This vote will last for ${
            gameConfig.HRS_CIVILIAN_ARREST_VOTE_DURATION
        } hours, then the verdict will be announced.`,
    });
    await createGenericPoll(
        civArrestMsg,
        hrsToMs(gameConfig.HRS_CIVILIAN_ARREST_VOTE_DURATION),
        null,
        async (user) => {
            const playerData = await getPlayerData(user);
            return playerData && playerData.alive;
        },
        async (result) => {
            if (result === "win") {
                if (targetData.ipp) {
                    await civArrestMsg.reply(
                        `The vote has passed, but **${target.displayName}** is now under IPP and cannot be arrested.`
                    );
                    return;
                }

                await civArrestMsg.reply(
                    `The vote has passed! **${target.displayName}** will be arrested for ${gameConfig.HRS_ARREST_DURATION} hours.`
                );
                await incarcerate(interaction.client, target);
                await createDelayedAction(
                    interaction.client,
                    "delayedRelease",
                    hrsToMs(gameConfig.HRS_ARREST_DURATION),
                    [target.id]
                );
            } else if (result === "loss") {
                await civArrestMsg.reply(
                    `The vote has failed! **${target.displayName}** will not be arrested.`
                );
            } else {
                await civArrestMsg.reply(
                    `The vote has been tied! **${target.displayName}** will not be arrested.`
                );
            }
        }
    );

    return true;
}

const namesToCallbacks = {
    onPseudocideRevival: onPseudocideRevival,
    scheduledDeath: onScheduledKill,
    stopBlackout: stopBlackout,
    delayedRelease: delayedRelease,
    kidnapRelease: kidnapRelease,
};

async function executeDelayedActionEarly(client, actionId) {
    const actionDoc = await DelayedAction.findById(actionId);
    if (!actionDoc) return;
    const callback = namesToCallbacks[actionDoc.actionName];
    if (!callback)
        return console.error("Callback not found", actionDoc.actionName);
    try {
        await callback(client, ...actionDoc.arguments);
        await DelayedAction.deleteOne({ _id: actionId });
    } catch (err) {
        console.error("Failed executing early delayed action:", err);
    }
}

// initializes all delayed actions. call on bot start.
async function initializeDelayedActions(client) {
    const delayedActions = await DelayedAction.find({});
    await Promise.all(
        delayedActions.map((action) => initializeDelayedAction(client, action))
    );
}

// starts the timer for the delayed action in the current session
async function initializeDelayedAction(client, delayedAction) {
    const endTime = delayedAction.timeBegan + delayedAction.delay;
    const remaining = Math.max(0, endTime - Date.now());

    setTimeout(async () => {
        const delayedActionDoc = await DelayedAction.findById(
            delayedAction._id
        );
        if (!delayedActionDoc) return;
        const callback = namesToCallbacks[delayedAction.actionName];
        if (typeof callback !== "function") {
            console.error(
                "Delayed action callback not found:",
                delayedAction.actionName
            );
            return;
        }
        try {
            await callback(client, ...delayedAction.arguments);
            await DelayedAction.deleteOne({ _id: delayedAction._id });
        } catch (err) {
            console.error(
                "Failed executing delayed action:",
                delayedAction,
                err
            );
        }
    }, remaining);
}

// creates a delayed action in a db and starts its timer in the current session
// the timer will persist throughout sessions using the db entry
async function createDelayedAction(
    client,
    actionName,
    delayTime,
    arguments = []
) {
    try {
        const delayedAction = await DelayedAction.create({
            timeBegan: Date.now(),
            delay: delayTime,
            actionName: actionName,
            arguments: arguments,
        });
        console.log("Delayed action created:", delayedAction);
        await initializeDelayedAction(client, delayedAction);
        return delayedAction._id;
    } catch (err) {
        console.error("Failed to create delayed action:", err);
    }
}

module.exports = {
    createGenericPoll,
    createDelayedAction,
    contact,
    addUserToGroupChat,
    changeGroupChatOwner,
    removeUserFromGroupChat,
    createGroupChat,
    civilianArrest,
    changeGroupChatName,
    role,
    kill,
    cleanSlate,
    nextDay,
    startBlackout,
    stopBlackout,
    underTheRadar,
    getPlayerData,
    getOrganisationData,
    updatePlayerData,
    updateOrganisationData,
    newSeason,
    closeLounge,
    hideLounges,
    unhideLounges,
    guildIsNotebook,
    writeName,
    setNotebook,
    loadScheduledDeaths,
    pseudocide,
    ipp,
    passNotebook,
    unlock2ndKira,
    addAffiliation,
    removeAffiliation,
    restrictNotebooks,
    freeNotebooks,
    incarcerate,
    release,
    announce,
    setChannelLoggable,
    bug,
    autopsy,
    initializeDelayedActions,
    strippedName,
    kidnap,
    earlyKidnapRelease,
    anonymousAnnouncement,
    eyes,
    custody,
    removeCustody,
};
