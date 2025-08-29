const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("unlock2ndkira")
        .setDescription("Unlocks 2nd Kira's notebook.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        await game.unlock2ndKira();

        await interaction.editReply({
            content: "2nd Kira can now use their notebook.",
            ephemeral: true,
        });
    },
};
