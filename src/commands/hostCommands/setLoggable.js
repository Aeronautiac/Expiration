// creates notebook data for the channel the command is written in. the channel will behave as a death note.
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setloggable")
        .setDescription(
            "Set a channel as loggable or disable logging in a channel (allows things like bug and autopsy)"
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addBooleanOption((option) =>
            option
                .setName("loggable")
                .setDescription(
                    "Turn logging on or off in this channel. True for on, false for off."
                )
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const result = await game.setChannelLoggable(
            interaction.channel.id,
            interaction.options.getBoolean("loggable")
        );

        if (result !== true) {
            await interaction.editReply({
                content: result,
                ephemeral: true,
            });
            return;
        }

        await interaction.editReply({
            content: "Success.",
            ephemeral: true,
        });
    },
};
