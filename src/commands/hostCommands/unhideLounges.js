const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("unhidelounges")
        .setDescription("Remove a hide reason for the player's lounges")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("the person to unhide the lounges of")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("reason")
                .setDescription("the hide reason to remove")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const target = interaction.options.getUser("target");
        const reason = interaction.options.getString("reason");

        game.unhideLounges(interaction.client, target, reason);

        await interaction.editReply({
            content: `Successfully removed lounge blocker \"${reason}\" for ${target}.`,
            ephemeral: true,
        });
    },
};
