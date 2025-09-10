import { SlashCommandBuilder } from "discord.js";
import game from "../../game";
import { interaction } from "../../types";
import Lounge from "../../models/lounge";

export default {
    data: new SlashCommandBuilder()
        .setName("close")
        .setDescription("Close a lounge."),

    async execute(interaction: interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const lounges = await Lounge.find({
            channelIds: interaction.channel.id,
        });

        if (lounges.length === 0) {
            interaction.editReply({
                content: "This is not a lounge channel.",
                ephemeral: true,
            });
            return;
        }

        await game.closeLounge(interaction.user, interaction.channel);

        await interaction.editReply({
            content: "Successfully closed lounge.",
            ephemeral: true,
        });
    },
};
