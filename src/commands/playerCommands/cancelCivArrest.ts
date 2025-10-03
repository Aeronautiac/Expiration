import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import abilities from "../../core/abilities";

export default {
    data: new SlashCommandBuilder()
        .setName("cancelcivilianarrest")
        .setDescription("Cancel a civilian arrest. (THIS WILL NOT REFUND YOUR ABILITY)")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person to cancel for.")
                .setRequired(true)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const result = await abilities.useAbility(interaction.user.id, "cancelCivArrest", {
            targetId: interaction.options.getUser("target").id,
        });
        if (!result.success)
            await interaction.editReply({
                content: result.message || "Failed to cancel civilian arrest.",
            });
        else
            await interaction.editReply({
                content: "Success.",
            });
    },
};
