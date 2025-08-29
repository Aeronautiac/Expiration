const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("getname")
        .setDescription("Get a player's true name.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person you want to view the name of.")
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
                content: `Cannot view name of ${target} as they have no player data.`,
            });
            return;
        }

        await interaction.editReply({
            content: `The true name of ${target} is ${targetData.trueName}.`,
            ephemeral: true,
        });
    },
};
