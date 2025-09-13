import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import Lounge from "../../models/lounge";
import contacting from "../../core/contacting";

export default {
    data: new SlashCommandBuilder()
        .setName("close")
        .setDescription("Close a lounge."),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const lounge = await Lounge.findOne({
            channelIds: interaction.channel.id,
        });

        if (!lounge) {
            interaction.editReply({
                content: "This is not a lounge channel.",
            });
            return;
        }

        await contacting.closeLounge(interaction.user.id, lounge.loungeId);

        await interaction.editReply({
            content: "Successfully closed lounge.",
        });
    },
};
