const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");
const KidnapLounge = require("../../models/kidnaplounge");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("releasekidnapearly")
        .setDescription("Release a player from a kidnap.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person you want to release")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const target = interaction.options.getUser("target");
        const targetData = await game.getPlayerData(target);

        if (!targetData) {
            await interaction.editReply({
                content: `Cannot release ${target} as they have no player data.`,
            });
            return;
        }

        const kidnapDoc = await KidnapLounge.findOne({ victimId: target.id });
        await game.earlyKidnapRelease(interaction.client, kidnapDoc);

        await interaction.editReply({
            content: `Player ${target} has been released.`,
            ephemeral: true,
        });
    },
};
