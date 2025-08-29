const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("addtokens")
        .setDescription(
            "Add to a player's token count. (If you wish to subtract tokens, supply a negative number)"
        )
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("the person to give the tokens to")
                .setRequired(true)
        )
        .addIntegerOption((option) =>
            option
                .setName("tokens")
                .setDescription("the number of tokens to add")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const target = interaction.options.getUser("target");
        const amt = interaction.options.getInteger("tokens");
        var playerData = await game.getPlayerData(target);

        if (!playerData) {
            await interaction.editReply({
                content: `${target} has no player data. Cannot modify token value.`,
                ephemeral: true,
            });
            return;
        }

        playerData = await game.updatePlayerData(target, {
            contactTokens: Math.max(0, playerData.contactTokens + amt),
        });

        await interaction.editReply({
            content: `Successfully added ${amt} to ${target}'s token count. They now have ${playerData.contactTokens} tokens.`,
            ephemeral: true,
        });
    },
};
