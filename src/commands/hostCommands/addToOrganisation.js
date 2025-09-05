// creates notebook data for the channel the command is written in. the channel will behave as a death note.
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("addtoorganisation")
        .setDescription("Add a member to an organisation.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person to add to the organisation")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("organisation")
                .setDescription("The organisation to add them to")
                .setRequired(true)
                .addChoices(
                    { name: "Kira's Kingdom", value: "Kira's Kingdom" },
                    { name: "Task Force", value: "Task Force" }
                )
        )
        .addBooleanOption(option =>
            option
                .setName("leader")
                .setDescription("Whether or not they are the leader of the organisation")
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option
                .setName("og")
                .setDescription("Whether or not they are considered an og member")
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        await game.addToOrganisation(interaction);

        await interaction.editReply({
            content: "Success.",
            ephemeral: true,
        });
    },
};
