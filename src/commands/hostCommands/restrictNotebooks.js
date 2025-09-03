const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("restrictnotebooks")
        .setDescription("Prevent a user from interacting with notebooks.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("the person to restrict ")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("reason")
                .setDescription("the restriction reason")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const target = interaction.options.getUser("target");
        const reason = interaction.options.getString("reason");

        await game.restrictNotebooks(target, reason);

        await interaction.editReply({
            content: `Successfully added notebook blocker \"${reason}\" for ${target}.`,
            ephemeral: true,
        });
    },
};
