import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";
import Player from "../../models/player";

export default {
    data: new SlashCommandBuilder()
        .setName("getinfo")
        .setDescription("Get a player's true name and role")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person you want to view the name of")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const target = interaction.options.getUser("target");
        const targetData = await Player.findOne({ userId: target.id });
        if (!targetData) {
            await interaction.editReply({
                content: `Cannot view info for ${target} as they have no player data.`,
            });
            return;
        }

        await interaction.editReply({
            content: `**Info for ${target}:**\n**True name:** ${targetData.trueName}\n**Role:** ${targetData.role}`,
        });
    },
};
