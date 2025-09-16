import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";
import Season from "../../models/season";
import game from "../../core/game";

export default {
    data: new SlashCommandBuilder()
        .setName("newseason")
        .setDescription("Create a new season")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        if (await Season.findOne({})) {
            await interaction.editReply({
                content:
                    "A season already exists. Use cleanslate if you wish to start a new season.",
            });
            return;
        }

        await game.newSeason();

        await interaction.editReply({
            content: "Successfully created a new season.",
        });
    },
};
