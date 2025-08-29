const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("hidelounges")
        .setDescription("Hide all of a player's lounges")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("the person to hide the lounges of")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("reason")
                .setDescription("the hide reason")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const target = interaction.options.getUser("target");
        const reason = interaction.options.getString("reason");

        await game.hideLounges(interaction.client, target, reason);

        await interaction.editReply({
            content: `Successfully added lounge blocker \"${reason}\" for ${target}.`,
            ephemeral: true,
        });
    },
};
