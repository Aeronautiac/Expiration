const { SlashCommandBuilder } = require("discord.js");
const gameConfig = require("../../../gameconfig.json");
const Player = require("../../models/player");
const game = require("../../game");

const abilitiesThatRequireAUserTarget = [
    "Public Kidnap", "Anonymous Kidnap", "Background Check", "Civilian Arrest", "Unlawful Arrest"
]
const abilitiesThatRequireAString = [
    "Tap In"
]

function choice(name) {
    return { name: name, value: name };
}

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

        // Check if player is alive
        if (!playerData.alive) {
            await interaction.editReply({
                content: "You are not alive.",
            });
            return;
        }
        // Check if player is part of organisation
        const guildId = interaction.guild.id
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
        const ourAffiliation = guildId === gameConfig.guildIds.tf ? "Task Force" : "Kira's Kingdom";

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
        const abilityRequiresATarget = abilitiesThatRequireAUserTarget.includes(action)
        const abilityRequiresAChannel = abilitiesThatRequireAString.includes(action)
        const target = interaction.options.getUser("target");
        const channel = interaction.options.getString("channel");

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
        }
        // Add cooldown to the organisation for the ability
        // await game.updateOrganisationData(ourAffiliation, {
        //     [`cooldowns.${action}`]: gameConfig.cooldowns[action],
        // });
        // Start a poll for the ability
        const client = interaction.client
        let requiredRoles = gameConfig.abilities[action].requiredRoles || [];
        let guild = await client.guilds.cache.get(guildId);
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

        const mainGuild = await client.guilds.fetch(gameConfig.guildIds.main);
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

        messageContent += `React with 👍 to approve or 👎 to deny. Once a vote majority is reached (${majority} votes), the decision will be made.`;

        const pollMessage = await loungeChannel.send({
            content: messageContent,
        });
        
        pollMessage.react("👍");
        pollMessage.react("👎");

        const filter = (reaction, user) => {
            return (
                ["👍", "👎"].includes(reaction.emoji.name) &&
                !user.bot &&
                guild.members.cache.has(user.id)
            );
        };

        const collector = pollMessage.createReactionCollector({ filter, time: 60 * 1000 * 60 }); // 1 hour timeout

        let upvotes = 0;
        let downvotes = 0;
        const votedUsers = new Set();

        collector.on("collect", async (reaction, user) => {
            if (votedUsers.has(user.id)) {
                return;
            };
            const voterData = await game.getPlayerData(user);
            if (!voterData || !voterData.alive) {
                console.log(voterData)
                return;
            }

            votedUsers.add(user.id);

            if (reaction.emoji.name === "👍") {
                upvotes++;
            }
            if (reaction.emoji.name === "👎") {
                downvotes++;
            }

            if (upvotes >= majority) {
                collector.stop("approved");
            } else if (downvotes >= majority) {
                collector.stop("denied");
            }   
        });

        collector.on("end", async (_, reason) => {
            if (reason === "approved") {
                pollMessage.reply(`The vote has passed! The **${action}** will be performed.`);
                
                const news = await client.channels.fetch(gameConfig.channelIds.news);

                if (action === "Background Check") {
                    const targetPlayerData = await game.getPlayerData(target);
                    if (targetPlayerData) {
                        const msg = await pollMessage.reply(`The true name of **${targetMember.displayName}** is **${targetPlayerData.trueName}**.`);
                        msg.pin();
                    }
                } else if (action === "Civilian Arrest") {
                    const civArrestMsg = await news.send({
                        content: `@ everyone The @Task Force has started a civilian arrest on **${targetMember.displayName}**. Vote 👍 if you would like this person to be arrested for 1 day. Vote 👎 if you do not want this person to be arrested. This vote will last for 6 hours, then the verdict will be announced.`
                    });
                    civArrestMsg.react("👍");
                    civArrestMsg.react("👎");

                    const collector = civArrestMsg.createReactionCollector({ filter, time: 5000 }); // 5 sec timeout
                    // const collector = civArrestMsg.createReactionCollector({ filter, time: 60 * 1000 * 60 * 5 }); // 5 hour timeout

                    let upvotes = 0;
                    let downvotes = 0;
                    const votedUsers = new Set();

                    collector.on("collect", async (reaction, user) => {
                        if (votedUsers.has(user.id)) {
                            return;
                        };
                        const voterData = await game.getPlayerData(user);
                        if (!voterData || !voterData.alive) {
                            console.log(voterData)
                            return;
                        }

                        votedUsers.add(user.id);

                        if (reaction.emoji.name === "👍") {
                            upvotes++;
                        }
                        if (reaction.emoji.name === "👎") {
                            downvotes++;
                        }
                    });

                    collector.on("end", async () => {
                        if (upvotes > downvotes) {
                            civArrestMsg.reply("The vote has passed. The **Civilian Arrest** will be carried out.");
                            game.incarceratePlayer(client, target);
                        } else if (upvotes < downvotes) {
                            civArrestMsg.reply("The vote has failed. The **Civilian Arrest** has been cancelled.");
                        } else {
                            civArrestMsg.reply("The vote has ended with a tie! Nothing will happen.");
                        }
                    });
                } else if (action === "Unlawful Arrest" || action === "PI+Watari Unlawful Arrest") {
                    news.send({
                        content: `@everyone The @Task Force have performed an unlawful arrest on **${targetMember.displayName}**. They will return from their sentence in 24 hours.`
                    });
                    game.incarceratePlayer(client, target);
                } else if (action === "Blackout") {
                    news.send({
                        content: `@everyone The @Kira's Kingdom have performed a blackout on the local network! All trials and news will cancel in 1 minute for 24 hours.`
                    });
                } else if (action === "Public Kidnap") {
                    news.send({
                        content: `@everyone The @Kira's Kingdom have performed a kidnapping on **${targetMember.displayName}**. They will return in 24 hours, or less - if they are charming, and the kidnapper will be announced upon their return.`
                    });
                } else if (action === "Anonymous Kidnap" || action === "2nd Kira+Kira Anonymous Kidnap") {
                    news.send({
                        content: `@everyone The @Kira's Kingdom have performed an anonymous kidnapping on **${targetMember.displayName}**. They will return in 24 hours, or less - if they are charming.`
                    });
                } else if (action === "Tap In") {

                }
            } else if (reason === "denied") {
                pollMessage.reply(`The vote has failed. The **${action}** has been cancelled.`);
            } else {
                pollMessage.reply("The vote has ended without reaching a majority.");
            }
        });

        await interaction.editReply({
            content: "Success!",
            ephemeral: true,
        });
    },
};
