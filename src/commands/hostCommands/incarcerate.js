const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("incarcerate")
        .setDescription("Incarcerate a player.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person you want to incarcerate")
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
                content: `Cannot incarcerate ${target} as they have no player data.`,
            });
            return;
        }

        await game.incarcerate(interaction.client, target);

        await interaction.editReply({
            content: `Player ${target} has been incarcerated.`,
            ephemeral: true,
        });
    },
};
