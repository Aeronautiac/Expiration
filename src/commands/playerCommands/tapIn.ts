import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import abilities from "../../core/abilities";
import { executionQueue } from "../../core/game";

export default {
    data: new SlashCommandBuilder()
        .setName("tapin")
        .setDescription("Tap into a lounge.")
        .addIntegerOption((option) =>
            option
                .setName("loungenumber")
                .setDescription("The lounge number to tap into.")
                .setRequired(true)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        await executionQueue.executeQueued(async () => {
            const result = await abilities.useAbility(
                interaction.user.id,
                "Tap In",
                {
                    startedBy: interaction.user.id,
                    loungeNumber: interaction.options.getInteger("loungenumber"),
                }
            );
            if (!result.success)
                await interaction.editReply({
                    content: result.message || "Failed to use tap in.",
                });
            else
                await interaction.editReply({
                    content: "Success.",
                });
        });
    },
};
