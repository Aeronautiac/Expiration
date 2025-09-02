const { SlashCommandBuilder } = require("discord.js");
const gameConfig = require("../../../gameconfig.json");
const Player = require("../../models/player");
const game = require("../../game");

const abilitiesThatRequireAUserTarget = [
    "Public Kidnap", "Anonymous Kidnap", "Background Check", "Civilian Arrest", "Unlawful Arrest"
]
const abilitiesThatRequireAKidnapper = [
    "Public Kidnap"
]
const abilitiesThatRequireAChannel = [
    "Tap In"
]

function choice(name) {
    return { name: name, value: name };
}

function hrsToMs(hrs) {
    return 1000 * 60 * 60 * hrs;
}

const HOURS_FOR_CIVILIAN_ARREST_VOTE = 6;
const HOURS_ARRESTED_FOR = 24;
const HOURS_BLACKOUT_DURATION = 24;
const MS_TIME_BETWEEN_TAP_IN_CHUNKS = 6000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("startvote")
        .setDescription("Start a vote within your organisation to perform an action.")
        .addStringOption((option) =>
            option
                .setName("action")
                .setDescription("The action you want to vote for")
                .addChoices(
                    ...Object.keys(gameConfig.abilities).map(choice)
                )
                .setRequired(true)
        )
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The user to target with the action")
        )
        .addUserOption((option) =>
            option
                .setName("kidnapper")
                .setDescription("In a public kidnapping, this person will be revealed after the kidnapped victim has been released")
        )
        .addStringOption((option) =>
            option
                .setName("channel")
                .setDescription("The channel to use for the action")
        ),
    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const action = interaction.options.getString("action");
        const playerData = await game.getPlayerData(interaction.user);

        const client = interaction.client;
        const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
        const guildId = interaction.guild.id
        const guild = await client.guilds.cache.get(guildId);
        const ourAffiliation = guildId === gameConfig.guildIds.tf ? "Task Force" : "Kira's Kingdom";

        const abilityRequiresATarget = abilitiesThatRequireAUserTarget.includes(action)
        const abilityRequiresAChannel = abilitiesThatRequireAChannel.includes(action)
        const abilityRequiresAKidnapper = abilitiesThatRequireAKidnapper.includes(action)

        const target = interaction.options.getUser("target");
        const channel = interaction.options.getString("channel");
        const kidnapper = interaction.options.getUser("kidnapper");

        let tapInTargetChannel = null;
        // Check if player is alive
        if (!playerData.alive) {
            await interaction.editReply({
                content: "You are not alive.",
            });
            return;
        }
        // Check if player is part of organisation
        if (gameConfig.guildIds.tf !== guildId && gameConfig.guildIds.kk !== guildId) {
            await interaction.editReply({
                content: "This can only be ran within an organisation.",
            });
            return;
        }
        if (interaction.channel.name !== "lounge") {
            await interaction.editReply({
                content: "This command can only be used in the lounge channel.",
            });
            return;
        }
        // Check if vote is part of correct organisation (TF cant use KK ability)
        if (gameConfig.abilities[action].organisation && gameConfig.abilities[action].organisation !== ourAffiliation) {
            await interaction.editReply({
                content: "You are not allowed to start a vote for this action.",
            });
            return;
        }
        // Check if organisation ability is on cooldown
        const orgData = await game.getOrganisationData(ourAffiliation);
        if (orgData.cooldowns[action]) {
            await interaction.editReply({
                content: `The ${action} ability is on cooldown.`,
            });
            return;
        }
        // If the ability requires a target and one is not provided, return
        if (abilityRequiresATarget) {
            if (!target) {
                await interaction.editReply({
                    content: "This ability requires a target input.",
                });
                return;
            }
            // Check if target is alive
            const targetData = await game.getPlayerData(target);
            if (!targetData || !targetData.alive) {
                await interaction.editReply({
                    content: "The target must be alive.",
                });
                return;
            }
        }
        if (abilityRequiresAChannel) {
            if (!channel) {
                await interaction.editReply({
                    content: "This ability requires a channel input.",
                });
                return;
            }
            if (!Number(channel)) {
                await interaction.editReply({
                    content: "The channel must be a valid number.",
                });
                return;
            }

            const loungeChannelName = `lounge-${channel}`;
            const loungeChannels = await mainGuild.channels.fetch();
            tapInTargetChannel = loungeChannels.find(c => c.name === loungeChannelName && c.type === 0); // type 0 = GUILD_TEXT
            if (!tapInTargetChannel) {
                await interaction.editReply({
                    content: `Could not find channel named ${loungeChannelName}.`,
                });
                return;
            }
        }
        if (abilityRequiresAKidnapper) {
            if (!kidnapper) {
                await interaction.editReply({
                    content: "This ability requires a kidnapper input.",
                });
                return;
            }
            // Check if kidnapper is alive
            const kidnapperData = await game.getPlayerData(kidnapper);
            if (!kidnapperData || !kidnapperData.alive) {
                await interaction.editReply({
                    content: "The kidnapper must be alive.",
                });
                return;
            }
        }

        // Start a poll for the ability
        let requiredRoles = gameConfig.abilities[action].requiredRoles || [];
        let membersInOrganisation = 0;

        for (const member of guild.members.cache.values()) {
            if (member.user.bot) continue;
            const playerData = await game.getPlayerData(member.user);
            if (playerData && playerData.alive) {
                if (requiredRoles.includes(playerData.role)) {
                    // Remove the player's role from requiredRoles
                    const roleIndex = requiredRoles.indexOf(playerData.role);
                    if (roleIndex !== -1) {
                        requiredRoles.splice(roleIndex, 1);
                    }
                }
                membersInOrganisation++;
            }
        }

        if (requiredRoles.length > 0) {
            await interaction.editReply({
                content: `This ability requires specific roles within the organisation. Roles required: **${requiredRoles.join(", ")}**`,
            });
            return;
        }

        if (gameConfig.abilities[action].membersRequired && membersInOrganisation < gameConfig.abilities[action].membersRequired) {
            await interaction.editReply({
                content: `This ability requires at least ${gameConfig.abilities[action].membersRequired} members to be alive in your organisation. You only have ${membersInOrganisation} alive members.`,
            });
            return;
        }

        const majority = Math.ceil(membersInOrganisation * 0.5);
        const loungeChannel = await client.channels.fetch(interaction.channel.id);
        let messageContent = `@everyone A vote has been started for a **${action}**. `;
        let targetMember = null;
        if (abilityRequiresATarget) {
            targetMember = await mainGuild.members.fetch(target.id);
            messageContent += `This will target **${targetMember.displayName}**. `;
        }
        if (abilityRequiresAChannel) {
            messageContent += `This will target lounge **${channel}**. `;
        }

        messageContent += `React with 👍 to approve or 👎 to deny. Once a vote majority is reached (${majority + 1} votes), the decision will be made.`;

        const pollMessage = await loungeChannel.send({
            content: messageContent,
        });

        game.createGenericPoll(pollMessage, 60 * 1000 * 60, majority,
            async (user) => {
                const playerData = await game.getPlayerData(user);
                return playerData && playerData.alive;
            },
            async (result) => {
                if (result === "win") {
                    pollMessage.reply(`The vote has passed! The **${action}** will be performed. This ability will now go on a cooldown of ${gameConfig.abilities[action].cooldown} day(s).`);

                    // Do another cooldown check here incase players stack polls.. Those cheeky players...
                    const orgData = await game.getOrganisationData(ourAffiliation);
                    if (orgData.cooldowns[action]) {
                        await interaction.editReply({
                            content: `The ${action} ability is on cooldown.`,
                        });
                        return;
                    }

                    // Add cooldown to the organisation for the ability
                    await game.updateOrganisationData(ourAffiliation, {
                        [`cooldowns.${action}`]: gameConfig.abilities[action].cooldown,
                    });

                    const news = await client.channels.fetch(gameConfig.channelIds.news);
                    const affiliationMention = `<@&${gameConfig.roleIds[ourAffiliation]}>`;

                    if (action === "Background Check") {
                        const targetPlayerData = await game.getPlayerData(target);
                        if (targetPlayerData) {
                            const msg = await pollMessage.reply(`The true name of **${targetMember.displayName}** is **${targetPlayerData.trueName}**.`);
                            msg.pin();
                        }
                    } else if (action === "Civilian Arrest") {
                        const civArrestMsg = await news.send({
                            content: `@everyone The ${affiliationMention} has started a civilian arrest on **${targetMember.displayName}**. Vote 👍 if you would like this person to be arrested for 1 day. Vote 👎 if you do not want this person to be arrested. This vote will last for ${HOURS_FOR_CIVILIAN_ARREST_VOTE} hours, then the verdict will be announced.`
                        });

                        game.createGenericPoll(civArrestMsg, hrsToMs(HOURS_FOR_CIVILIAN_ARREST_VOTE), null,
                            async (user) => {
                                const playerData = await game.getPlayerData(user);
                                return playerData && playerData.alive;
                            },
                            async (result) => {
                                if (result === "win") {
                                    civArrestMsg.reply("The vote has passed. The **Civilian Arrest** will be carried out.");
                                    game.incarcerate(client, target);
                                } else if (result === "lose") {
                                    civArrestMsg.reply("The vote has failed. The **Civilian Arrest** has been cancelled.");
                                } else {
                                    civArrestMsg.reply("The vote has ended with a tie! Nothing will happen.");
                                }
                            });
                    } else if (action === "Unlawful Arrest" || action === "PI+Watari Unlawful Arrest") {
                        news.send({
                            content: `@ everyone The ${affiliationMention} have performed an unlawful arrest on **${targetMember.displayName}**. They will return from their sentence in ${HOURS_ARRESTED_FOR} hours.`
                        });
                        game.incarcerate(client, target);
                        game.createDelayedAction(client, "delayedRelease", hrsToMs(HOURS_ARRESTED_FOR), [target.id]);
                    } else if (action === "Blackout") {
                        news.send({
                            content: `@everyone The ${affiliationMention} have performed a blackout on the local network! All trials will cancel and news will stop in 1 minute for ${HOURS_BLACKOUT_DURATION} hours.`
                        });
                        setTimeout(() => {
                            game.startBlackout(client);
                            game.createDelayedAction(client, "stopBlackout", hrsToMs(HOURS_BLACKOUT_DURATION));
                        }, 60 * 1000);
                    } else if (action === "Public Kidnap") {
                        news.send({
                            content: `@everyone The ${affiliationMention} have performed a kidnapping on **${targetMember.displayName}**. They will return in 24 hours, or less - if they are charming, and the kidnapper will be announced upon their return.`
                        });
                    } else if (action === "Anonymous Kidnap" || action === "2nd Kira+Kira Anonymous Kidnap") {
                        news.send({
                            content: `@everyone The ${affiliationMention} have performed an anonymous kidnapping on **${targetMember.displayName}**. They will return in 24 hours, or less - if they are charming.`
                        });
                    } else if (action === "Tap In") {
                        const kiraGuild = await client.guilds.fetch(gameConfig.guildIds.kk);

                        const logChannel = await kiraGuild.channels.fetch("1412209917623799858"); // tap-in-logs channel id
                        await new Promise(res => setTimeout(res, MS_TIME_BETWEEN_TAP_IN_CHUNKS));
                        const pinMsg = await logChannel.send(`**<@&1410716175859453962> Tap In Logs For Lounge ${channel}**`); // KK role in KK server
                        await pinMsg.pin();

                        // Announce tap in the tapped channel
                        await tapInTargetChannel.send(`**The <@&${gameConfig.roleIds["Kira's Kingdom"]}> have tapped into this channel. All messages before this one have been logged.**`);

                        const messages = await tapInTargetChannel.messages.fetch({ limit: 100 });
                        const ordered = Array.from(messages.values()).reverse();

                        let lastSpeakerId = null;
                        let currentBlock = [];
                        let currentBlockName = "";
                        let blockText = "";
                        let chunks = [];
                        const CHUNK_LIMIT = 2000;

                        // Send a block as chunks, ensuring no message is split
                        async function sendBlock(blockName, blockLines) {
                            if (blockLines.length === 0) return;
                            let prefix = `\`\`\`${blockName}:\`\`\`\n`;
                            let chunk = prefix;
                            for (let i = 0; i < blockLines.length; i++) {
                                let line = blockLines[i];
                                // If adding this line would exceed the limit, send the chunk and start a new one (fixes timestamp being cut off and looking very bad lol)
                                if ((chunk.length + line.length) > CHUNK_LIMIT) {
                                    await logChannel.send(chunk);
                                    await new Promise(res => setTimeout(res, MS_TIME_BETWEEN_TAP_IN_CHUNKS));
                                    // Start new chunk with prefix and current line
                                    chunk = prefix + line;
                                } else {
                                    chunk += (chunk === prefix ? "" : "\n") + line;
                                }
                            }
                            // Send any remaining chunk
                            if (chunk.length > prefix.length) {
                                await logChannel.send(chunk);
                                await new Promise(res => setTimeout(res, MS_TIME_BETWEEN_TAP_IN_CHUNKS));
                            }
                        }

                        await new Promise(res => setTimeout(res, MS_TIME_BETWEEN_TAP_IN_CHUNKS));

                        for (const msg of ordered) {
                            if (msg.author.bot) continue;
                            // Get display name from mainGuild. This should probably be stored as a table outside this scope but apparently fetch isn't expensive? IDK LOL!
                            let mainMember;
                            try {
                                mainMember = await mainGuild.members.fetch(msg.author.id);
                            } catch {
                                mainMember = null;
                            }
                            const displayName = mainMember ? mainMember.displayName : msg.author.username;

                            // Check for image attachments without links (if an img is sent without a link, the bot sends an empty string as a log)
                            let imageLinks = [];
                            if (msg.attachments && msg.attachments.size > 0) {
                                msg.attachments.forEach(att => {
                                    if (att.contentType && att.contentType.startsWith('image/') && att.url) {
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

                        await new Promise(res => setTimeout(res, MS_TIME_BETWEEN_TAP_IN_CHUNKS));
                        await logChannel.send(`**End of Tap In Logs For Lounge ${channel}**`);
                    }
                } else if (result === "loss") {
                    pollMessage.reply(`The vote has failed. The **${action}** has been cancelled.`);
                } else {
                    pollMessage.reply(`No majority was reached so no decision could be made. The **${action}** has been cancelled.`);
                }
            }
        );
        await interaction.editReply({
            content: "Success!",
            ephemeral: true,
        });
    },
};
