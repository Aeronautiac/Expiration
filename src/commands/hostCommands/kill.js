const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("kill")
        .setDescription("Kill a player.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person you want to kill")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("message")
                .setDescription("the death message")
                .setRequired(false)
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
                content: `Cannot kill ${target} as they have no player data.`,
            });
            return;
        }

        game.kill(interaction);

        await interaction.editReply({
            content: `Player ${target} has been marked as dead and removed from all of their lounges.`,
            ephemeral: true,
        });
    },
};
