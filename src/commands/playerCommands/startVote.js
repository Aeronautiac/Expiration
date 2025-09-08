const { SlashCommandBuilder } = require("discord.js");
const gameConfig = require("../../../gameconfig.json");
const Player = require("../../models/player");
const game = require("../../game");

const abilitiesThatRequireAUserTarget = [
    "Public Kidnap",
    "Anonymous Kidnap",
    "Background Check",
    "Civilian Arrest",
    "Unlawful Arrest",
];
const abilitiesThatRequireAKidnapper = ["Public Kidnap"];
const abilitiesThatRequireAChannel = ["Tap In"];

function choice(name) {
    return { name: name, value: name };
}

function hrsToMs(hrs) {
    return 1000 * 60 * 60 * hrs;
}

const MS_TIME_BETWEEN_TAP_IN_CHUNKS = 6000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("startvote")
        .setDescription(
            "Start a vote within your organisation to perform an action."
        )
        .addStringOption((option) =>
            option
                .setName("action")
                .setDescription("The action you want to vote for")
                .addChoices(
                    ...Object.keys(gameConfig.organisationAbilities).map(choice)
                )
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("target")
                .setDescription(
                    "The USER ID of the target the action should affect"
                )
        )
        .addUserOption((option) =>
            option
                .setName("kidnapper")
                .setDescription(
                    "In a public kidnapping, this person will be revealed after the kidnapped victim has been released"
                )
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
        const guildId = interaction.guild.id;
        const guild = await client.guilds.cache.get(guildId);
        const ourAffiliation =
            guildId === gameConfig.guildIds.tf
                ? "Task Force"
                : "Kira's Kingdom";
        const abilityConfig = gameConfig.organisationAbilities[action];

        const abilityRequiresATarget =
            abilitiesThatRequireAUserTarget.includes(action);
        const abilityRequiresAChannel =
            abilitiesThatRequireAChannel.includes(action);
        const abilityRequiresAKidnapper =
            abilitiesThatRequireAKidnapper.includes(action);

        const targetId = interaction.options.getString("target");
        const target = await mainGuild.members.fetch(targetId);
        const targetUser = await client.users.fetch(targetId).catch(() => null);
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
        if (
            gameConfig.guildIds.tf !== guildId &&
            gameConfig.guildIds.kk !== guildId
        ) {
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
        if (
            abilityConfig.organisation &&
            abilityConfig.organisation !== ourAffiliation
        ) {
            await interaction.editReply({
                content: "You are not allowed to start a vote for this action.",
            });
            return;
        }
        // Check if organisation ability is on cooldown
        const orgData = await game.getOrganisationData(ourAffiliation);
        if (orgData.cooldowns.get(action)) {
            await interaction.editReply({
                content: `The ${action} ability is on cooldown.`,
            });
            return;
        }
        // If the ability requires a target and one is not provided, return
        if (abilityRequiresATarget) {
            if (!targetId) {
                await interaction.editReply({
                    content: "This ability requires a target input.",
                });
                return;
            }
            if (!target) {
                await interaction.editReply({
                    content:
                        "The target must be a valid USER ID of a player. If you are confused, @coolman.",
                });
                return;
            }
            const targetData = await game.getPlayerData(targetUser);
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
            tapInTargetChannel = loungeChannels.find(
                (c) => c.name === loungeChannelName && c.type === 0
            ); // type 0 = GUILD_TEXT
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
        let requiredRoles = abilityConfig.requiredRoles || [];
        // let membersInOrganisation = 0;

        const alivePlayersWithAffiliation = await Player.find({
            affiliations: ourAffiliation,
            alive: true,
        });
        const membersInOrganisation = alivePlayersWithAffiliation.length;
        const membersWhoCanVote = (
            await Player.find({
                affiliations: ourAffiliation,
                alive: true,
                loungeHideReasons: { $size: 0 },
            })
        ).length;

        for (const player of alivePlayersWithAffiliation) {
            if (player && player.alive) {
                if (requiredRoles.includes(player.role)) {
                    // Remove the player's role from requiredRoles
                    const roleIndex = requiredRoles.indexOf(player.role);
                    if (roleIndex !== -1) {
                        requiredRoles.splice(roleIndex, 1);
                    }
                }
            }
        }

        if (requiredRoles.length > 0) {
            await interaction.editReply({
                content: `This ability requires specific roles within the organisation. Roles required: **${requiredRoles.join(
                    ", "
                )}**`,
            });
            return;
        }

        console.log("reached here");

        if (
            abilityConfig.membersRequired &&
            membersInOrganisation < abilityConfig.membersRequired
        ) {
            await interaction.editReply({
                content: `This ability requires at least ${abilityConfig.membersRequired} members to be alive in your organisation. You only have ${membersInOrganisation} alive members.`,
            });
            return;
        }
        if (action.includes("Arrest") || action.includes("Kidnap")) {
            if (
                target.roles.cache.some(
                    (r) =>
                        r.id === gameConfig.roleIds.Arrested ||
                        r.id === gameConfig.roleIds.Kidnapped
                )
            ) {
                await interaction.editReply({
                    content:
                        "You cannot start a lock up on someone that is already locked up.",
                });
                return;
            }
        }

        const majority = /*Math.floor(membersWhoCanVote / 2) + 1*/ 1;
        const loungeChannel = await client.channels.fetch(
            interaction.channel.id
        );
        let messageContent = `@everyone A vote has been started for a **${action}**. `;
        if (abilityRequiresATarget) {
            messageContent += `This will target **${target.displayName}**. `;
        }
        if (abilityRequiresAChannel) {
            messageContent += `This will target lounge **${channel}**. `;
        }

        messageContent += `React with 👍 to approve or 👎 to deny. Once a vote majority is reached (${
            majority + 1
        } votes), the decision will be made.`;

        const pollMessage = await loungeChannel.send({
            content: messageContent,
        });

        // console.log("reached here");
        await game.createGenericPoll(
            pollMessage,
            60 * 1000 * 60,
            majority,
            async (user) => {
                const playerData = await game.getPlayerData(user);
                return playerData && playerData.alive;
            },
            async (result) => {
                if (result === "win") {
                    await pollMessage.reply(
                        `The vote has passed! The **${action}** will be performed. If this ability is able to be used, it will go on a cooldown of ${abilityConfig.cooldown} day(s).`
                    );

                    // Do another cooldown check here incase players stack polls.. Those cheeky players...
                    const orgData = await game.getOrganisationData(
                        ourAffiliation
                    );
                    if (orgData.cooldowns.get(action)) {
                        await pollMessage.reply({
                            content: `The ${action} ability is on cooldown.`,
                        });
                        return;
                    }

                    const news = await client.channels.fetch(
                        gameConfig.channelIds.news
                    );
                    const affiliationMention = `<@&${gameConfig.roleIds[ourAffiliation]}>`;

                    if (action === "Background Check") {
                        const targetPlayerData = await game.getPlayerData(
                            targetUser
                        );
                        if (targetPlayerData) {
                            const msg = await pollMessage.reply(
                                `The true name of **${game.strippedName(
                                    target.displayName
                                )}** is **${targetPlayerData.trueName}**.`
                            );
                            msg.pin();
                        }
                    } else if (action === "Civilian Arrest") {
                        const civArrestMsg = await news.send({
                            content: `@everyone The ${affiliationMention} has started a civilian arrest on **${game.strippedName(
                                target.displayName
                            )}**. Vote 👍 if you would like this person to be arrested for ${
                                gameConfig.HRS_ARREST_DURATION
                            } hours. Vote 👎 if you do not want this person to be arrested. This vote will last for ${
                                gameConfig.HRS_CIVILIAN_ARREST_VOTE_DURATION
                            } hours, then the verdict will be announced.`,
                        });

                        await game.createGenericPoll(
                            civArrestMsg,
                            hrsToMs(
                                gameConfig.HRS_CIVILIAN_ARREST_VOTE_DURATION
                            ),
                            null,
                            async (user) => {
                                const playerData = await game.getPlayerData(
                                    user
                                );
                                return playerData && playerData.alive;
                            },
                            async (result) => {
                                const targetData = await game.getPlayerData(
                                    target
                                );
                                if (result === "win") {
                                    if (targetData.ipp) {
                                        await civArrestMsg.reply(
                                            `The vote has passed, but **${target.displayName}** is now under IPP and cannot be arrested.`
                                        );
                                        return;
                                    }
                                    await civArrestMsg.reply(
                                        "The vote has passed. The **Civilian Arrest** will be carried out."
                                    );
                                    await game.incarcerate(client, targetUser);
                                    await game.createDelayedAction(
                                        client,
                                        "delayedRelease",
                                        hrsToMs(gameConfig.HRS_ARREST_DURATION),
                                        [targetId]
                                    );
                                } else if (result === "lose") {
                                    await civArrestMsg.reply(
                                        "The vote has failed. The **Civilian Arrest** has been cancelled."
                                    );
                                } else {
                                    await civArrestMsg.reply(
                                        "The vote has ended with a tie! Nothing will happen."
                                    );
                                }
                            }
                        );
                    } else if (
                        action === "Unlawful Arrest" ||
                        action === "PI+Watari Unlawful Arrest"
                    ) {
                        const targetData = await game.getPlayerData(target);
                        if (targetData.ipp) {
                            await pollMessage.reply(
                                `The vote has passed, but **${target.displayName}** is now under IPP and cannot be arrested.`
                            );
                            return;
                        }
                        await news.send({
                            content: `@everyone The ${affiliationMention} have performed an unlawful arrest on **${target.displayName}**. They will return from their sentence in ${gameConfig.HRS_ARREST_DURATION} hours.`,
                        });
                        await game.incarcerate(client, target);
                        await game.createDelayedAction(
                            client,
                            "delayedRelease",
                            hrsToMs(gameConfig.HRS_ARREST_DURATION),
                            [targetId]
                        );
                    } else if (action === "Blackout") {
                        await news.send({
                            content: `@everyone The ${affiliationMention} have performed a blackout on the local network! All trials will cancel and news will stop in 1 minute for ${gameConfig.HRS_BLACKOUT_DURATION} hours.`,
                        });
                        setTimeout(async () => {
                            await game.startBlackout(client);
                            await game.createDelayedAction(
                                client,
                                "stopBlackout",
                                hrsToMs(gameConfig.HRS_BLACKOUT_DURATION)
                            );
                        }, 60 * 1000);
                    } else if (action === "Public Kidnap") {
                        const result = await game.kidnap(
                            client,
                            guild,
                            targetId,
                            kidnapper.id
                        );
                        if (result !== true) {
                            await pollMessage.reply({
                                content: result,
                            });
                            return;
                        }
                        await news.send({
                            content: `@everyone The ${affiliationMention} have performed a kidnapping on **${game.strippedName(
                                target.displayName
                            )}**. They will return in 24 hours, or less - if they are charming. The kidnapper will be announced upon their return.`,
                        });
                    } else if (
                        action === "Anonymous Kidnap" ||
                        action === "2nd Kira+Kira Anonymous Kidnap"
                    ) {
                        const result = await game.kidnap(
                            client,
                            guild,
                            targetId
                        );
                        if (result !== true) {
                            await pollMessage.reply({
                                content: result,
                            });
                            return;
                        }
                        await news.send({
                            content: `@everyone The ${affiliationMention} have performed an anonymous kidnapping on **${game.strippedName(
                                target.displayName
                            )}**. They will return in 24 hours, or less - if they are charming.`,
                        });
                    } else if (action === "Tap In") {
                        const kiraGuild = await client.guilds.fetch(
                            gameConfig.guildIds.kk
                        );

                        const logChannel = await kiraGuild.channels.fetch(
                            gameConfig.channelIds.tapinLogs
                        ); // tap-in-logs channel id
                        await new Promise((res) =>
                            setTimeout(res, MS_TIME_BETWEEN_TAP_IN_CHUNKS)
                        );
                        const pinMsg = await logChannel.send(
                            `**<@&1410716175859453962> Tap In Logs For Lounge ${channel}**`
                        ); // KK role in KK server
                        await pinMsg.pin();

                        // Announce tap in the tapped channel
                        await tapInTargetChannel.send(
                            `**The <@&${gameConfig.roleIds["Kira's Kingdom"]}> have tapped into this channel. All messages before this one have been logged.**`
                        );

                        const messages =
                            await tapInTargetChannel.messages.fetch({
                                limit: 100,
                            });
                        const ordered = Array.from(messages.values()).reverse();

                        let lastSpeakerId = null;
                        let currentBlock = [];
                        let currentBlockName = "";
                        const CHUNK_LIMIT = 2000;

                        // Send a block as chunks, ensuring no message is split
                        async function sendBlock(blockName, blockLines) {
                            if (blockLines.length === 0) return;
                            let prefix = `\`\`\`${blockName}:\`\`\`\n`;
                            let chunk = prefix;
                            for (let i = 0; i < blockLines.length; i++) {
                                let line = blockLines[i];
                                // If adding this line would exceed the limit, send the chunk and start a new one (fixes timestamp being cut off and looking very bad lol)
                                if (chunk.length + line.length > CHUNK_LIMIT) {
                                    await logChannel.send(chunk);
                                    await new Promise((res) =>
                                        setTimeout(
                                            res,
                                            MS_TIME_BETWEEN_TAP_IN_CHUNKS
                                        )
                                    );
                                    // Start new chunk with prefix and current line
                                    chunk = prefix + line;
                                } else {
                                    chunk +=
                                        (chunk === prefix ? "" : "\n") + line;
                                }
                            }
                            // Send any remaining chunk
                            if (chunk.length > prefix.length) {
                                await logChannel.send(chunk);
                                await new Promise((res) =>
                                    setTimeout(
                                        res,
                                        MS_TIME_BETWEEN_TAP_IN_CHUNKS
                                    )
                                );
                            }
                        }

                        await new Promise((res) =>
                            setTimeout(res, MS_TIME_BETWEEN_TAP_IN_CHUNKS)
                        );

                        for (const msg of ordered) {
                            if (msg.author.bot) continue;
                            // Get display name from mainGuild. This should probably be stored as a table outside this scope but apparently fetch isn't expensive? IDK LOL!
                            const mainMember = await mainGuild.members
                                .fetch(msg.author.id)
                                .catch(() => null);
                            const displayName = mainMember
                                ? mainMember.displayName
                                : msg.author.username;

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
                                msgContent +=
                                    (msgContent ? "\n" : "") +
                                    imageLinks.join("\n");
                            }

                            // Format line with timestamp
                            const timestamp = `<t:${Math.floor(
                                msg.createdTimestamp / 1000
                            )}>`;
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

                        await new Promise((res) =>
                            setTimeout(res, MS_TIME_BETWEEN_TAP_IN_CHUNKS)
                        );
                        await logChannel.send(
                            `**End of Tap In Logs For Lounge ${channel}**`
                        );
                    }

                    // apply cooldowns (after ability usage so we can prevent things like kidnap being refused but cooldown still applied)
                    await game.updateOrganisationData(ourAffiliation, {
                        [`cooldowns.${action}`]: abilityConfig.cooldown,
                    });
                } else if (result === "loss") {
                    await pollMessage.reply(
                        `The vote has failed. The **${action}** has been cancelled.`
                    );
                } else {
                    await pollMessage.reply(
                        `No majority was reached so no decision could be made. The **${action}** has been cancelled.`
                    );
                }
            }
        );
        await interaction.editReply({
            content: "Success!",
            ephemeral: true,
        });
    },
};
