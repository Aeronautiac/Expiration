const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const game = require("../../game");
const gameConfig = require("../../../gameconfig.json");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("syncnicknames")
        .setDescription("Sync nicknames with the main server.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const mainGuild = await interaction.client.guilds.fetch(
            gameConfig.guildIds.main
        );

        const members = await mainGuild.members.fetch().catch(() => null);
        if (!members) {
            await interaction.editReply({
                content: "Failed to fetch members.",
                ephemeral: true,
            });
            return;
        }

        for (const member of members.values())
            await game.setNickname(
                interaction.client,
                member.user,
                member.displayName
            ).catch(() => {});

        await interaction.editReply({
            content: "Successfully synced nicknames.",
            ephemeral: true,
        });
    },
};
