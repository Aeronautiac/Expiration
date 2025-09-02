const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const gameConfig = require("../../../gameconfig.json");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("preparetrial")
        .setDescription("Prepare a trial for a prosecutor and a defendant.")
        .addUserOption((option) =>
            option
                .setName("prosecutor")
                .setDescription("The person you want to put on trial")
                .setRequired(true)
        )
        .addUserOption((option) =>
            option
                .setName("defendant")
                .setDescription("The person you want to defend")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("charges")
                .setDescription("The charges against the defendant")
                .setRequired(true)
        ),
    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const prosecutor = interaction.options.getUser("prosecutor");
        const defendant = interaction.options.getUser("defendant");
        const prosecutorData = await game.getPlayerData(prosecutor);
        const defendantData = await game.getPlayerData(defendant);
        const charges = await interaction.options.getString("charges");

        if (!prosecutorData || !prosecutorData.alive) {
            await interaction.editReply({
                content: `Cannot put ${prosecutor} on trial as they have no player data.`,
            });
            return;
        }
        if (!defendantData || !defendantData.alive) {
            await interaction.editReply({
                content: `Cannot defend ${defendant} as they have no player data.`,
            });
            return;
        }

        const mainGuild = await interaction.client.guilds.fetch(gameConfig.guildIds.main);
        const courtroomChannel = await mainGuild.channels.fetch(gameConfig.channelIds.courtroom);

        const prosecutorMember = await mainGuild.members
            .fetch(prosecutor.id)
            .catch(() => null);
        if (prosecutorMember) {
            await prosecutorMember.roles.add(gameConfig.roleIds.Prosecutor);
        }
        const defendantMember = await mainGuild.members
            .fetch(defendant.id)
            .catch(() => null);
        if (defendantMember) {
            await defendantMember.roles.add(gameConfig.roleIds.Custody);
            await defendantMember.roles.remove(gameConfig.roleIds.civ);
        }

        await courtroomChannel.send({
            content: `@everyone Court will be in session...\n\n${defendant} is being charged for **${charges}**.\n\nOur prosecutor tonight is ${prosecutor}.\n\nIf you wish to speak or object, please mention <@291616614347177984> and refer to them as 'your honor'... Disrespect will be punished...\n\nMay ${prosecutor} start us off.`,
        });

        await interaction.editReply({
            content: `Success. Go into the courtroom to continue. Do some manual work for once... Bum.`,
            ephemeral: true,
        });
    },
};
