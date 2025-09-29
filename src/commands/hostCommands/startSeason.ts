import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";
import Season from "../../models/season";
import game from "../../core/game";

export default {
    data: new SlashCommandBuilder()
        .setName("startseason")
        .setDescription("Start the current season")
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
        if (season.flags.get("active")) {
            await interaction.editReply({
                content: "The season has already started.",
            });
            return;
        }

        await game.startSeason();

        await interaction.editReply({
            content: "Successfully started the season.",
        });
    },
};
