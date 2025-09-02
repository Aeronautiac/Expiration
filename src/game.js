require("dotenv").config();
const fs = require("fs");
const { ChannelType, PermissionsBitField } = require("discord.js");
const { mongoose } = require("./mongoose");
const Player = require("./models/player");
const Lounge = require("./models/lounge");
const Season = require("./models/season");
const Notebook = require("./models/notebook");
const Organisation = require("./models/organisation");
const ScheduledDeath = require("./models/scheduledDeath");
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

async function getOrganisationData(organisationName) {
    return await Organisation.findOne({ name: organisationName });
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
        .split(" ") // split into words
        .map(
            (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ) // capitalize first letter, rest lowercase
        .join(" "); // join back with spaces
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
async function role(client, targetUser, role) {
    let playerData = await getPlayerData(targetUser);

    if (!playerData) {
        const name = await getRandomName();

        playerData = await Player.create({
            userId: targetUser.id,
            role: role,
            alive: true,
            lounges: [],
            contactTokens: gameConfig.dailyTokens,
            kills: 0,
            trueName: rawName(name),
            loungeHideReasons: [],
            affiliations: [],
            notebookRestrictReasons: [],
        });

        targetUser.send(`Your true name is ${name}`);
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

    await unhideLounges(client, targetUser, "dead");

    // roles
    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    const member = await mainGuild.members
        .fetch(targetUser.id)
        .catch(() => null);
    if (member) {
        // no need to await here
        member.roles.add(gameConfig.roleIds.civ);
        member.roles.remove(gameConfig.roleIds.shinigami);
    }
}

async function inviteToRoleGuilds(client, user) {
    const userData = await getPlayerData(user);
    if (!(userData.role in gameConfig.roleGuilds)) return;
    for (const guildName of gameConfig.roleGuilds[userData.role]) {
        const guildId = gameConfig.guildIds[guildName];
        try {
            const guild = await client.guilds.fetch(guildId);
            await inviteToGuild(client, guild, user.id);
        } catch (err) {
            console.log("Failed to invite to role guild:", err);
        }
    }
}

async function kickFromRoleGuilds(client, user) {
    for (const roleGuilds of Object.values(gameConfig.roleGuilds)) {
        for (const guildName of roleGuilds) {
            try {
                const guild = await client.guilds.fetch(
                    gameConfig.guildIds[guildName]
                );
                const member = await guild.members
                    .fetch(user.id)
                    .catch(() => null);
                if (member) await member.kick("lounges hidden");
            } catch (err) {
                console.log("Failed to kick from role discord:", err);
            }
        }
    }
}

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

    await kickFromRoleGuilds(client, user);
}

async function unhideLounges(client, user, reason) {
    const channels = client.channels;
    var playerData = await getPlayerData(user);

    playerData = await updatePlayerData(user, {
        loungeHideReasons: playerData.loungeHideReasons.filter((entry) => {
            return entry !== reason;
        }),
    });

    if (playerData.loungeHideReasons.length === 0) {
        for (const loungeId of playerData.loungeChannelIds) {
            const lounge = await channels.fetch(loungeId);
            if (!lounge) continue;

            await lounge.permissionOverwrites.edit(user.id, {
                ViewChannel: true,
            });
        }
    }

    await inviteToRoleGuilds(client, user);
}

async function deathMessage(
    client,
    user,
    message,
    trueName,
    role,
    hasNotebook,
    affiliatiated
) {
    const readablename = readableName(trueName);
    const affiliations = affiliatiated ?? [];

    const news = await client.channels.fetch(gameConfig.channelIds.news);

    const deathmessage =
        message ?? `${user} has died to a sudden heart attack.`;

    let output = `@ everyone ${deathmessage} [${user} (${readablename}) has died. Role: ${role}, Affiliations: ${
        affiliations.join(", ") || "none"
    }]`;

    if (hasNotebook)
        output = output.concat(
            `\nWhoever is responsible has now gained possession of their death note(s).`
        );

    news.send({
        content: output,
        allowedMentions: { parse: ["everyone"] },
    });
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

// returns the channel created and adds the channel id to the game's temporary channel array
async function createLoungeChannel(guild, channelName, loungeType, users) {
    const allChannels = await guild.channels.fetch();

    let categoryPrefix = null;
    if (loungeType === "monologue") {
        categoryPrefix = gameConfig.monologueCategoryPrefix;
    } else if (loungeType === "lounge") {
        categoryPrefix = gameConfig.loungeCategoryPrefix;
    } else if (loungeType === "groupchat") {
        categoryPrefix = gameConfig.groupchatCategoryPrefix;
    }

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
    const permissionOverwrites = [
        {
            id: guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
        },
    ];

    for (const user of users) {
        permissionOverwrites.push({
            id: user.id,
            allow: [PermissionsBitField.Flags.ViewChannel],
        });
    }

    permissionOverwrites.push({
        id: gameConfig.roleIds.spec,
        allow: [PermissionsBitField.Flags.ViewChannel],
    });

    // need to do this for all members of the lounge, not just civ role. this causes issues for things like custody as it is currently.
    permissionOverwrites.push({
        id: gameConfig.roleIds.civ,
        allow: [
            PermissionsBitField.Flags.AttachFiles,
            PermissionsBitField.Flags.EmbedLinks,
        ],
    });

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

    if (loungeType !== "monologue")
        await setChannelLoggable(newChannel.id, true);

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

    let logMessage = `Group chat created at <t:${time}> by ${userMember.displayName} with members:`;

    for (const member of members) {
        const memberUser = await mainGuild.members.fetch(member.id);
        logMessage += `\n${memberUser.displayName}`;
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
    const hostContactLogs = await channels.fetch(
        gameConfig.channelIds.hostContactLogs
    );
    await hostContactLogs.send(logMessage);
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
    let userDisplay = userMember.displayName;
    let targetDisplay = targetMember.displayName;

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
    }

    // host logs
    const hostContactLogs = await channels.fetch(
        gameConfig.channelIds.hostContactLogs
    );
    const loungeData = await Lounge.findOne({ loungeId: loungeId });

    const loungeChannels = await Promise.all(
        loungeData.channelIds.map((id) => channels.fetch(id))
    );
    for (const loungeChannel of loungeChannels)
        logMessage += ` ${loungeChannel.toString()}`;

    await hostContactLogs.send(logMessage);
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
        await addCooldown(user, "anonymousContact", 1);

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
        contactTokens: Math.max(0, playerData.contactTokens - 1 - (anonymous ? 1 : 0)),
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

    addUsersToChannel([target], channel);

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

    removeUsersFromChannel([target], channel);

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

// creates the data for the season
async function newSeason() {
    await Season.create({
        temporaryChannels: [],
        groupChats: [],
        day: 1,
    });

    await Organisation.updateMany({}, { $set: { cooldowns: {} } });
}

// any of the killUser functions should only be killed after onPlayerKillPlayer is called. This is to prevent some fuckery with stuff like death note ownership.
async function killUser(client, user, message, messageOverride, hadNotebook) {
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
            userData.affiliations
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

    // roles
    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    const member = await mainGuild.members.fetch(user.id).catch(() => null);
    if (member) {
        // no need to await here
        member.roles.add(gameConfig.roleIds.shinigami);
        member.roles.remove(gameConfig.roleIds.civ);
    }
}

async function killUserById(client, id, message, messageOverride, hadNotebook) {
    const user = await client.users.fetch(id);
    await killUser(client, user, message, messageOverride, hadNotebook);
}

// sets a player's alive status to false and hides all of their lounges from them
async function kill(interaction) {
    const target = interaction.options.getUser("target");
    const books = await Notebook.find({ currentOwner: target.id });
    const message = interaction.options.getString("message");
    await killUser(
        interaction.client,
        target,
        message,
        false,
        books.length > 0
    );
}

// chatgpt
async function deleteAllInvites(guild) {
    try {
        // Check if bot has permission
        if (
            !guild.members.me.permissions.has(
                PermissionsBitField.Flags.ManageGuild
            )
        ) {
            console.log(
                "I don't have permission to manage invites in this server!"
            );
            return;
        }

        // Fetch all invites
        const invites = await guild.invites.fetch();

        // Delete each invite
        for (const invite of invites.values()) {
            await invite.delete(`Bulk delete all invites`);
            console.log(`Deleted invite: ${invite.code}`);
        }

        console.log(`All invites deleted!`);
    } catch (err) {
        console.error("Error deleting invites:", err);
    }
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
}

async function inviteToGuild(client, guild, userId) {
    await deleteAllInvites(guild);

    const user = await client.users.fetch(userId);

    // Fetch all channels from Discord
    const channels = await guild.channels.fetch();

    // Find the channel by name
    const channel = channels.find(
        (ch) =>
            ch.isTextBased() &&
            ch.permissionsFor(guild.members.me)?.has("CreateInstantInvite")
    );

    const invite = await channel.createInvite({
        maxAge: 0,
        maxUses: 1,
        reason: "Gained notebook access.",
    });

    await user.send(invite.url);
}

// if guild is not a notebook yet, this function creates a new notebook and sets the current and original owner to owner.
// if guild is already a notebook, the notebook's current owner is updated to the next owner.
// in both cases, if the owner did not have access to the notebook yet, then they are invited to the guild.
// if a notebook owner loses access, then they are kicked from the guild.
// make sure to destroy all invites before any new invites are created. people might save invites.
// also kick everyone at the end of a season. (not handled by this function)
// if temporary is true, then instead of current owner being changed, temporary owner is changed. notebooks with temporary owners
// are sent back to their current owners when the next day begins.
async function setNotebook(client, guild, ownerid, temporary) {
    const existingBook = await Notebook.findOne({ guildId: guild.id });

    if (existingBook) {
        const currentHolder =
            existingBook.temporaryOwner ?? existingBook.currentOwner;
        const newHolder = ownerid;

        // if temporary, change the temporary owner field, otherwise, change current owner
        if (temporary) {
            await Notebook.updateOne(
                { _id: existingBook._id },
                { $set: { temporaryOwner: ownerid } }
            );
        } else {
            if (existingBook.currentOwner !== ownerid)
                await Notebook.updateOne(
                    { _id: existingBook._id },
                    { $set: { currentOwner: ownerid } }
                );
        }

        // if the person holding the notebook, changed, kick the old and invite the new
        if (newHolder !== currentHolder) {
            // kick old owner
            try {
                const oldOwnerMember = await guild.members
                    .fetch(currentHolder)
                    .catch(() => null);
                if (oldOwnerMember)
                    await oldOwnerMember.kick("No longer possesses notebook.");
            } catch (err) {
                console.log("Kick failed:", err);
            }

            // invite new owner
            try {
                await inviteToGuild(client, guild, ownerid);
            } catch (err) {
                console.log("Failed to invite user:", err);
            }
        }

        // if the notebook was being held temporarily before the posession change, then remove the temporary owner field
        if (existingBook.temporaryOwner && !temporary) {
            await Notebook.updateOne(
                { _id: existingBook._id },
                { $unset: { temporaryOwner: "" } }
            );
        }

        // if the owner didn't change but they're not in the server, then invite them back.
        if (currentHolder === newHolder && !existingBook.temporaryOwner) {
            try {
                await inviteToGuild(client, guild, ownerid);
            } catch (err) {
                console.log("Failed to invite user:", err);
            }
        }

        return;
    }

    await Notebook.create({
        guildId: guild.id,
        usedToday: [],
        currentOwner: ownerid,
        originalOwner: ownerid,
    });

    await inviteToGuild(client, guild, ownerid);
}

async function handlePlayerKill(client, killerId, targetId, message) {
    const targetData = await Player.findOne({ userId: targetId });

    if (!targetData) return;

    if (!targetData.ipp) {
        const targetNotebooks = await Notebook.find({ currentOwner: targetId });
        await onPlayerKillPlayer(client, killerId, targetId);
        await killUserById(
            client,
            targetId,
            message,
            false,
            targetNotebooks.length > 0
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
    const season = await Season.findById("season");
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

async function kickNotebookOwners(client) {
    const notebooks = await Notebook.find({});

    for (const notebook of notebooks) {
        try {
            const guild = await client.guilds.fetch(notebook.guildId);
            await deleteAllInvites(guild);
            const member = await guild.members
                .fetch(notebook.currentOwner)
                .catch(() => null);
            if (member) member.kick("Game reset");
        } catch (err) {
            console.log("Failed to kick notebook owner:", err);
        }
    }
}

// cleans all game data
// should remove everyone from death note servers
async function cleanSlate(client) {
    await nextDay(client);
    // must be called after nextDay
    await kickNotebookOwners(client);
    await clearContactLogs(client.channels);
    await clearTemporaryChannels(client);
    // must be called last
    await resetDatabase();
}

// returns true if the user is able to use the under the radar ability
async function canGoUtr(user) {
    const season = await Season.findOne({ _id: "season" });

    if (!season) return false;

    let playerData = await getPlayerData(user);

    if (!(playerData.role === "Kira" || playerData.role === "2nd Kira"))
        return false;
    if (!playerData.alive) return false;
    if (playerData.underTheRadarCharges && playerData.underTheRadarCharges <= 0)
        return false;
    if (playerData.underTheRadar) return false;

    return true;
}

// resets all player's contact tokens to the daily token amount
async function resetTokens() {
    await Player.updateMany({}, { contactTokens: gameConfig.dailyTokens });
}

// uses under the radar on a player
async function utr(user) {
    if (!(await canGoUtr(user))) {
        return;
    }

    const userData = await getPlayerData(user);
    const charges = Math.max((userData.underTheRadarCharges ?? 2) - 1, 0);

    await updatePlayerData(user, {
        usedUnderTheRadar: true,
        underTheRadarCharges: charges,
    });
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

async function applyPseudocideCooldowns(client) {
    const pseudosUsedToday = await Player.find({
        pseudocideUsedToday: true,
    });
    for (const player of pseudosUsedToday) {
        try {
            const user = await client.users.fetch(player.userId);
            await addCooldown(user, "pseudocide", 1);
            player.pseudocideUsedToday = false;
            player.pseudocideCharges = undefined;
            await player.save();
        } catch (err) {
            console.log("Failed to update pseudocide cooldown:", err);
        }
    }
}

async function applyIppCooldowns(client) {
    const ippsUsedToday = await Player.find({
        ippUsedToday: true,
    });
    for (const player of ippsUsedToday) {
        try {
            const user = await client.users.fetch(player.userId);
            await addCooldown(user, "ipp", 1);
            player.ippUsedToday = false;
            player.ippCharges = undefined;
            await player.save();
        } catch (err) {
            console.log("Failed to update ipp cooldown:", err);
        }
    }
}

async function removeBugs(guild) {
    const buggedPlayers = await Player.find({ bugged: true });

    await Player.updateMany({ bugged: true }, { bugged: false });

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

// resets tokens for all player, progresses cooldowns by one day, and deactivates any abilities that should only last for a day.
async function nextDay(client) {
    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    await resetTokens();
    await returnNotebooks(client);
    await progressCooldowns();
    await Player.updateMany({ underTheRadar: true }, { underTheRadar: false });
    await removeBugs(mainGuild);
    await disableIPPs(mainGuild);
    await resetNotebookCooldowns();
    await applyPseudocideCooldowns(client);
    await applyIppCooldowns(client);
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
                console.error(`Failed to delete message ${message.id}:`, err);
            }
        }
    } while (fetched.size > 0);
}

async function clearContactLogs(channels) {
    await clearChannel(
        await channels.fetch(gameConfig.channelIds.watariContactLogs)
    );
    await clearChannel(
        await channels.fetch(gameConfig.channelIds.hostContactLogs)
    );
}

async function pseudocide(interaction) {
    const season = await Season.findOne({});
    const user = interaction.user;
    const target = interaction.options.getUser("target");
    const role = interaction.options.getString("role");
    const trueName = interaction.options.getString("truename");
    const message = interaction.options.getString("deathmessage");
    const hasNotebook = interaction.options.getBoolean("hasnotebook");
    const affiliationsString = interaction.options.getString("affiliations");
    const userData = await getPlayerData(user);
    const targetData = await getPlayerData(target);

    let affiliations = [];
    if (affiliationsString) affiliations = affiliationsString.split(", ");

    if (!season) return "A season is not yet active.";
    if (!userData) return "You do not have any data.";
    if (!userData.alive) return "You are dead.";
    if (!targetData) return "This user has no data.";
    if (!targetData.alive) return "This user is dead.";
    if (targetData.ipp) return "This user is under IPP.";
    if (userData.role !== "BB") return "You are not BB.";
    if (userData.cooldowns.get("pseudocide")) return "Pseudocide on cooldown.";
    if (
        userData.pseudocideCharges !== null &&
        userData.pseudocideCharges !== undefined &&
        userData.pseudocideCharges <= 0
    )
        return "You are out of pseudocides.";

    if (userData.pseudocideCharges !== null)
        await Player.updateOne(
            { _id: userData._id },
            { $inc: { pseudocideCharges: -1 } }
        );

    if (
        userData.pseudocideCharges === null ||
        userData.pseudocideCharges === undefined
    )
        await Player.updateOne(
            { _id: userData._id },
            { $set: { pseudocideCharges: clamp(season.day, 1, 2) - 1 } }
        );

    await killUser(interaction.client, target, null, true);
    await deathMessage(
        interaction.client,
        target,
        message,
        trueName,
        role,
        hasNotebook,
        affiliations
    );

    await createDelayedAction(
        interaction.client,
        "onPseudocideRevival",
        hrsToMs(24),
        [target.id, targetData.role]
    );

    await Player.updateOne(
        { _id: userData._id },
        { $set: { pseudocideUsedToday: true } }
    );

    return true;
}

async function ipp(interaction) {
    const season = await Season.findOne({});
    const user = interaction.user;
    const target = interaction.options.getUser("target");
    const userData = await getPlayerData(user);
    const targetData = await getPlayerData(target);
    const mainGuild = await interaction.client.guilds.fetch(
        gameConfig.guildIds.main
    );
    const targetMember = await mainGuild.members.fetch(target.id);

    if (!season) return "The season has not yet begun.";
    if (!userData) return "You have no data.";
    if (!userData.alive) return "You are dead.";
    if (!targetData) return "This user has no data.";
    if (!targetData.alive) return "This user is dead.";
    if (userData.role !== "PI") return "You are not PI.";
    if (userData.cooldowns.get("ipp")) return "IPP on cooldown.";
    if (
        userData.ippCharges !== null &&
        userData.ippCharges !== undefined &&
        userData.ippCharges <= 0
    )
        return "You are out of IPP charges.";

    if (userData.ippCharges !== null)
        await Player.updateOne(
            { _id: userData._id },
            { $inc: { ippCharges: -1 } }
        );

    if (userData.ippCharges === null || userData.ippCharges === undefined)
        await Player.updateOne(
            { _id: userData._id },
            { $set: { ippCharges: clamp(season.day, 1, 2) - 1 } }
        );

    await updatePlayerData(target, {
        ipp: true,
    });
    await targetMember.setNickname(`${targetMember.displayName} (IPP)`);

    await Player.updateOne(
        { _id: userData._id },
        { $set: { ippUsedToday: true } }
    );

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

    userData.affiliations.filter((aff) => aff !== affiliation);
    await userData.save();

    return true;
}

async function restrictNotebook(user, reason) {
    const userData = await getPlayerData(user);

    if (!userData) return "This user has no data.";
    if (!userData.notebookRestrictReasons.includes(reason))
        return "User's notebook is already blocked by this.";

    userData.notebookRestrictReasons.push(reason);
    await userData.save();

    return true;
}

async function freeNotebook(user, reason) {
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
    }

    await hideLounges(client, user, "incarcerated");
    await restrictNotebook(user, "incarcerated");
}

async function release(client, user) {
    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    const member = await mainGuild.members.fetch(user.id).catch(() => null);
    if (member) {
        await member.roles.remove(gameConfig.roleIds.Arrested);
    }
    
    await unhideLounges(client, user, "incarcerated");
    await freeNotebook(user, "incarcerated");
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

async function bug(interaction) {
    const season = await Season.findOne({});
    const user = interaction.user;
    const target = interaction.options.getUser("target");
    const userData = await getPlayerData(user);
    const targetData = await getPlayerData(target);
    const mainGuild = await interaction.client.guilds.fetch(
        gameConfig.guildIds.main
    );
    const targetMember = await mainGuild.members.fetch(target.id);

    if (!season) return "The season has not yet begun.";
    if (!userData) return "You have no data.";
    if (!userData.alive) return "You are dead.";
    if (!targetData) return "This user has no data.";
    if (!targetData.alive) return "This user is dead.";
    if (userData.role !== "Watari") return "You are not Watari.";
    if (userData.cooldowns.get("bug")) return "Bug on cooldown.";

    await addCooldown(user, "bug", 2);

    // notify user that they have been bugged
    try {
        await target.send("You have been bugged by Watari.");
    } catch (err) {
        console.log("Failed to notify user of bug.", err);
    }

    await updatePlayerData(target, {
        bugged: true,
    });

    // Function to insert '*' before any parenthetical suffix (chatgpt generated)
    function addBugAsterisk(displayName) {
        if (displayName.includes("*")) return displayName; // prevent double asterisk
        const match = displayName.match(/\s\([^)]+\)$/);
        if (match) {
            return displayName.replace(match[0], `*${match[0]}`);
        } else {
            return displayName + "*";
        }
    }

    const newNickname = addBugAsterisk(targetMember.displayName);
    await targetMember.setNickname(newNickname);

    return true;
}

async function fetchAllMessages(channel, predicate = () => true) {
    let allMessages = [];
    let lastId;

    while (true) {
        const options = { limit: 100 };
        if (lastId) {
            options.before = lastId;
        }

        const messages = await channel.messages.fetch(options);

        if (messages.size === 0) {
            break; // no more messages
        }

        for (const msg of messages.values()) {
            if (predicate(msg)) allMessages.push(msg);
        }

        lastId = messages.last().id; // move the cursor back
    }

    return allMessages;
}

// just search through all loggable channels and then order based on time from oldest to newest
// then, send the messages to autopsy logs
async function autopsy(interaction) {
    const season = await Season.findOne({});
    const user = interaction.user;
    const target = interaction.options.getUser("target");
    const userData = await getPlayerData(user);
    const targetData = await getPlayerData(target);

    if (!season) return "The season has not yet begun.";
    if (!userData) return "You have no data.";
    if (!userData.alive) return "You are dead.";
    if (!targetData) return "This user has no data.";
    if (targetData.alive) return "This user is not dead.";
    if (userData.role !== "PI") return "You are not the PI.";
    if (userData.cooldowns.get("autopsy")) return "Autopsy on cooldown.";

    await addCooldown(user, "autopsy", 1);

    const timeOfDeath = targetData.timeOfDeath;
    const hrs3 = hrsToMs(3);
    const autopsyLogs = await interaction.client.channels.fetch(
        gameConfig.channelIds.autopsyLogs
    );

    let allMessages = [];
    for (const channelId of season.messageLoggedChannels) {
        const channel = await interaction.client.channels
            .fetch(channelId)
            .catch(() => null);
        if (!channel) continue;
        const channelMessages = await fetchAllMessages(channel, (msg) => {
            const timeSinceSent = Math.max(
                0,
                timeOfDeath - msg.createdTimestamp
            );
            return timeSinceSent <= hrs3;
        });
        allMessages.push(...channelMessages);
    }

    // remove messages that are not sent by the person being autopsied
    allMessages = allMessages.filter(
        (message) => message.author.id === target.id
    );

    // sort in ascending order based on timestamp
    allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    // send autopsy notifier
    await autopsyLogs.send({
        content: `=====================================\nAutopsy logs for ${target}:`,
    });

    // send all messages in autopsy logs
    for (const message of allMessages) {
        try {
            await autopsyLogs.send({
                content: `[<t:${Math.floor(
                    message.createdTimestamp / 1000
                )}>] ${message.content}`,
                files: [...message.attachments.values()],
            });
        } catch (err) {
            console.log("Failed to send message in autopsy logs", err);
        }
    }

    await autopsyLogs.send({
        content: "=====================================",
    });

    return true;
}

async function startBlackout(client) {
    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    const newsChannel = await mainGuild.channels.fetch(gameConfig.channelIds.news);
    await newsChannel.permissionOverwrites.edit(gameConfig.roleIds.civ, {
        ViewChannel: false,
    });
}

async function stopBlackout(client) {
    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    const newsChannel = await mainGuild.channels.fetch(gameConfig.channelIds.news);
    await newsChannel.permissionOverwrites.edit(gameConfig.roleIds.civ, {
        ViewChannel: true,
    });

    await newsChannel.send({
        content: `@everyone The local network seems to be back up... The blackout has ended!`
    });
}

async function delayedRelease(client, targetId) {
    const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
    const newsChannel = await mainGuild.channels.fetch(gameConfig.channelIds.news);
    const target = await mainGuild.members.fetch(targetId);
    await newsChannel.send({
        content: `@everyone It appears that the <@&${gameConfig.roleIds["Task Force"]}> have finally released **${target.displayName}**. Lets hope they don't return to their old ways.`
    });

    await release(client, target);
}

const filter = (reaction, user) => {
    return (
        ["👍", "👎"].includes(reaction.emoji.name) &&
        !user.bot
    );
};
async function createGenericPoll(message, duration, majorityToWin, participationRequirementCallback, callback) {
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
            const userReactions = message.reactions.cache.filter(r => r.users.cache.has(user.id));
            // If user already voted for 👍 and now tries 👎, deny 👎
            if (
            reaction.emoji.name === "👎" &&
            userReactions.some(r => r.emoji.name === "👍")
            ) {
            reaction.users.remove(user.id);
            return;
            }
            // If user already voted for 👎 and now tries 👍, deny 👍
            if (
            reaction.emoji.name === "👍" &&
            userReactions.some(r => r.emoji.name === "👎")
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

const namesToCallbacks = {
    onPseudocideRevival: onPseudocideRevival,
    scheduledDeath: onScheduledKill,
    stopBlackout: stopBlackout,
    delayedRelease: delayedRelease,
};

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
    } catch (err) {
        console.error("Failed to create delayed action:", err);
    }
}

module.exports = {
    createGenericPoll,
    createDelayedAction,
    contact,
    addUserToGroupChat,
    removeUserFromGroupChat,
    createGroupChat,
    changeGroupChatName,
    role,
    kill,
    cleanSlate,
    nextDay,
    startBlackout,
    stopBlackout,
    utr,
    getPlayerData,
    getOrganisationData,
    updatePlayerData,
    updateOrganisationData,
    canGoUtr,
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
    restrictNotebook,
    freeNotebook,
    incarcerate,
    release,
    announce,
    setChannelLoggable,
    bug,
    autopsy,
    initializeDelayedActions,
};
