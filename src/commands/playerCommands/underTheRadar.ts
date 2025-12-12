import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import abilities from "../../core/abilities";
import { executionQueue } from "../../core/game";

export default {
    data: new SlashCommandBuilder()
        .setName("undertheradar")
        .setDescription("Go under the radar."),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        await executionQueue.executeQueued(async () => {
            const result = await abilities.useAbility(
                interaction.user.id,
                "underTheRadar",
                {}
            );
            if (!result.success)
                await interaction.editReply({
                    content: result.message || "Failed to go under the radar.",
                });
            else
                await interaction.editReply({
                    content: "Success.",
                });
        });
    },
};
