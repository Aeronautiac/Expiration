const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("nextday")
        .setDescription(
            "Progress to the next day. (resets contact tokens, decreases cooldowns, etc...)"
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        await game.nextDay(interaction.client);

        await interaction.editReply({
            content: "Successfully progressed to the next day.",
            ephemeral: true,
        });
    },
};
