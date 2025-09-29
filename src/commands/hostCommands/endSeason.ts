import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";
import Season from "../../models/season";
import game from "../../core/game";
import { channels } from "../../configs/channels";

export default {
    data: new SlashCommandBuilder()
        .setName("endseason")
        .setDescription("End the current season")
        .addBooleanOption((option) =>
            option
                .setName("announce")
                .setDescription(
                    "Announces season end and gives roles and announces roles."
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

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

        await game.endSeason(
            interaction.options.getBoolean("announce") ?? false
        );

        await interaction.editReply({
            content: "Successfully ended the season.",
        });
    },
};
