import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";
import Season from "../../models/season";
import game from "../../core/game";

export default {
    data: new SlashCommandBuilder()
        .setName("endseason")
        .setDescription("End the current season")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const season = await Season.findOne({});
        if (!season) {
            await interaction.editReply({
                content: "No season currently exists.",
            });
            return;
        }
        if (!season.flags.get("active")) {
            await interaction.editReply({
                content: "The season has already ended.",
            });
            return;
        }

        await game.endSeason();

        await interaction.editReply({
            content: "Successfully ended the season.",
        });
    },
};
