import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import abilities from "../../core/abilities";
import { executionQueue } from "../../core/game";

export default {
    data: new SlashCommandBuilder()
        .setName("bug")
        .setDescription("Bug a player.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person to bug.")
                .setRequired(true)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        await executionQueue.executeQueued(async () => {
            const result = await abilities.useAbility(
                interaction.user.id,
                "bug",
                {
                    targetId: interaction.options.getUser("target").id,
                }
            );
            if (!result.success)
                await interaction.editReply({
                    content: result.message || "Failed to use bug.",
                });
            else
                await interaction.editReply({
                    content: "Success.",
                });
        });
    },
};
