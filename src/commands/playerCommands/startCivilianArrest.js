const { SlashCommandBuilder } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("startcivilianarrest")
        .setDescription("As a News Anchor, you can start a civilian arrest on anyone.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription(
                    "Who do you want to start a civilian arrest on?"
                )
                .setRequired(true)
        ),
    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const result = await game.civilianArrest(interaction);

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
