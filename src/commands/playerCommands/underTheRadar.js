const { SlashCommandBuilder } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("undertheradar")
        .setDescription("Go under the radar."),

    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        // do the thing here
        const result = await game.underTheRadar(interaction);

        if (result !== true) {
            await interaction.editReply({
                content: result,
                ephemeral: true,
            });
        } else {
            await interaction.editReply({
                content: "Success.",
                ephemeral: true,
            });
        }
    },
};
