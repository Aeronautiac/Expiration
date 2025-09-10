import { SlashCommandBuilder } from "discord.js";
import game from "../../game";
import { interaction } from "../../types";

export default {
    data: new SlashCommandBuilder()
        .setName("anonymousannouncement")
        .setDescription("Send an anonymous announcement.")
        .addStringOption((option) =>
            option
                .setName("message")
                .setDescription("the message to send")
                .setRequired(true)
        ),

    async execute(interaction: interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const result = await game.anonymousAnnouncement(interaction);
        if (result !== true) {
            await interaction.editReply({
                content: result,
                ephemeral: true,
            });
            return;
        }

        await interaction.editReply({
            content: "Successfully announced.",
            ephemeral: true,
        });
    },
};
