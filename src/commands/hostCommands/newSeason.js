const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");
const Season = require("../../models/season");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("newseason")
        .setDescription("Create new season data.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        if (await Season.findById("season")) {
            await interaction.editReply({
                content:
                    "Season data already exists. Use cleanslate if you wish to start a new season.",
                ephemeral: true,
            });
            return;
        }

        await game.newSeason();

        await interaction.editReply({
            content: "Successfully created new season data.",
            ephemeral: true,
        });
    },
};
