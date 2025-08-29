const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("freenotebook")
        .setDescription("Removes a notebook blocker from a user.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("the person to remove the blocker from ")
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

        await game.freeNotebook(target, reason);

        await interaction.editReply({
            content: `Successfully removed notebook blocker \"${reason}\" for ${target}.`,
            ephemeral: true,
        });
    },
};
