const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");

function choice(name) {
    return { name: name, value: name };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("role")
        .setDescription(
            "Give a player a role, and set their alive status to true."
        )
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person you want to give the role to")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("role")
                .setDescription("The role to give the player")
                .addChoices(
                    choice("Civilian"),
                    choice("Rogue Civilian"),
                    choice("Watari"),
                    choice("L"),
                    choice("Kira"),
                    choice("2nd Kira"),
                    choice("BB"),
                    // choice("Near"),
                    // choice("Mello"),
                    choice("PI"),
                    choice("News Anchor")
                )
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        game.role(
            interaction.client,
            interaction.options.getUser("target"),
            interaction.options.getString("role")
        );

        interaction.editReply({
            content: `Successfully gave role \"${interaction.options.getString(
                "role"
            )}\" to ${interaction.options.getUser("target")}.`,
            ephemeral: true,
        });
    },
};
