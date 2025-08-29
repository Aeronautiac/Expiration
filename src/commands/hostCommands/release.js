const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("release")
        .setDescription("Release a player from incarceration.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person you want to release")
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
                content: `Cannot release ${target} as they have no player data.`,
            });
            return;
        }

        await game.release(interaction.client, target);

        await interaction.editReply({
            content: `Player ${target} has been released.`,
            ephemeral: true,
        });
    },
};
