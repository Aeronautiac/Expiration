const { SlashCommandBuilder } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ipp")
        .setDescription("Put a player under IPP.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person to protect.")
                .setRequired(true)
        ),
    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        // do the thing here
        const result = await game.ipp(interaction);

        if (result !== true) {
            await interaction.editReply({
                content: result,
                ephemeral: true,
            });
        } else {
            await interaction.editReply({
                content: "Success. You will be able to use IPP again in 2 days.",
                ephemeral: true,
            });
        }
    },
};
