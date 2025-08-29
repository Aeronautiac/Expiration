const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("addaffiliation")
        .setDescription("Add an affiliation to a player's data.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("the person to add the affiliation to")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("affiliation")
                .setDescription("the affiliation to add")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const target = interaction.options.getUser("target");
        const affiliation = interaction.options.getString("affiliation");

        const result = await game.addAffiliation(target, affiliation);

        if (result !== true) {
            await interaction.editReply({
                content: `Failed to add affiliation to user: ${result}`,
                ephemeral: true,
            });
            return;
        }

        await interaction.editReply({
            content: `Successfully added affiliation \"${affiliation}\" for ${target}.`,
            ephemeral: true,
        });
    },
};
