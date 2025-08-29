const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("removeaffiliation")
        .setDescription("Remove an affiliation from a player's data.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("the person to remove the affiliation from")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("affiliation")
                .setDescription("the affiliation to remove")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const target = interaction.options.getUser("target");
        const affiliation = interaction.options.getString("affiliation");

        const result = await game.removeAffiliationAffiliation(target, affiliation);

        if (result !== true) {
            await interaction.editReply({
                content: `Failed to remove affiliation from user: ${result}`,
                ephemeral: true,
            });
            return;
        }

        await interaction.editReply({
            content: `Successfully removed affiliation \"${affiliation}\" from ${target}.`,
            ephemeral: true,
        });
    },
};
