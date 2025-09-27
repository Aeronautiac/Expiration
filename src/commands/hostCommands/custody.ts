import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";
import game from "../../core/game";
import Player from "../../models/player";

export default {
    data: new SlashCommandBuilder()
        .setName("custody")
        .setDescription("Put a player into custody.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person you want to put into custody")
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
                content: `Cannot put ${target} into custody as they have no player data.`,
            });
            return;
        }

        await game.custody(target.id);

        await interaction.editReply({
            content: `Player ${target} has been put into custody.`,
        });
    },
};
