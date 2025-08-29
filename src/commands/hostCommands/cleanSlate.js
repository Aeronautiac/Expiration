const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");
const Season = require("../../models/season");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("cleanslate")
        .setDescription("Clears all game data. (USE WITH CAUTION)")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const season = await Season.findById("season");
        if (!season) {
            await interaction.editReply({
                content: `Cannot use clean slate if there is no season data.`,
                ephemeral: true,
            });
            return;
        }

        if (season.temporaryChannels.includes(interaction.channel.id)) {
            await interaction.editReply({
                content: `Cannot use clean slate inside of a temporary channel.`,
                ephemeral: true,
            });
            return;
        }

        game.cleanSlate(interaction.client);

        await interaction.editReply({
            content: `Successfully cleared all game data.`,
            ephemeral: true,
        });
    },
};
