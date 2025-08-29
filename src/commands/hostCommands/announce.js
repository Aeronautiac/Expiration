const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("announce")
        .setDescription("Make the bot say something in news.")
        .addStringOption((option) =>
            option
                .setName("message")
                .setDescription("the message to send")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        await game.announce(
            interaction.client,
            interaction.options.getString("message")
        );

        await interaction.editReply({
            content: "Successfully announced.",
            ephemeral: true,
        });
    },
};
