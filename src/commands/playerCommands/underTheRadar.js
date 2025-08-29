const { SlashCommandBuilder } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("undertheradar")
        .setDescription("Go under the radar."),

    async execute(interaction) {
        if (!(await game.canGoUtr(interaction.user))) {
            await interaction.reply({
                content: "You cannot use under the radar.",
                ephemeral: true,
            });
            return;
        }

        await game.utr(interaction.user);

        await interaction.reply({
            content: "You are now under the radar.",
            ephemeral: true,
        });
    },
};
