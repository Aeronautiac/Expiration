import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import abilities from "../../core/abilities";

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

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const result = await abilities.useAbility(
            interaction.user.id,
            "anonymousAnnouncement",
            {
                message: interaction.options.getString("message"),
            }
        );
        if (!result.success)
            await interaction.editReply({
                content:
                    result.message || "Failed to use anonymous announcement.",
            });
        else
            await interaction.editReply({
                content: "Successfully announced.",
            });
    },
};
