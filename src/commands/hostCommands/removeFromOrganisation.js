// creates notebook data for the channel the command is written in. the channel will behave as a death note.
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("removefromorganisation")
        .setDescription("Remove a member from an organisation.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person to remove from the organisation")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("organisation")
                .setDescription("The organisation to remove them from")
                .setRequired(true)
                .addChoices(
                    { name: "Kira's Kingdom", value: "Kira's Kingdom" },
                    { name: "Task Force", value: "Task Force" }
                )
        ),

    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        await game.removeFromOrganisation(interaction);

        await interaction.editReply({
            content: "Success.",
            ephemeral: true,
        });
    },
};
