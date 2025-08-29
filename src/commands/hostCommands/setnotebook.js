// creates notebook data for the channel the command is written in. the channel will behave as a death note.
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setnotebook")
        .setDescription("Set a channel as a notebook.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption((option) =>
            option
                .setName("ownerid")
                .setDescription("The userid of the owner of the notebook")
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        await game.setNotebook(
            interaction.client,
            interaction.guild,
            interaction.options.getString("ownerid")
        );

        await interaction.editReply({
            content: "Success.",
            ephemeral: true,
        });
    },
};
