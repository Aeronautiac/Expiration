import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import abilities from "../../core/abilities";
import { executionQueue } from "../../core/game";

export default {
    data: new SlashCommandBuilder()
        .setName("ipp")
        .setDescription("Put a player under IPP.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person to protect.")
                .setRequired(true)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        await executionQueue.executeQueued(async () => {
            const result = await abilities.useAbility(
                interaction.user.id,
                "ipp",
                {
                    targetId: interaction.options.getUser("target").id,
                }
            );
            if (!result.success)
                await interaction.editReply({
                    content: result.message || "Failed to use IPP.",
                });
            else
                await interaction.editReply({
                    content: "Success.",
                });
        });
    },
};
