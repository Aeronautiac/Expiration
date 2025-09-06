const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("custody")
        .setDescription("Put a player into custody.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person you want to put into custody")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const target = interaction.options.getUser("target");
        const targetData = await game.getPlayerData(target);

        if (!targetData) {
            await interaction.editReply({
                content: `Cannot put ${target} into custody as they have no player data.`,
            });
            return;
        }

        await game.custody(interaction.client, target);

        await interaction.editReply({
            content: `Player ${target} has been put into custody.`,
            ephemeral: true,
        });
    },
};
