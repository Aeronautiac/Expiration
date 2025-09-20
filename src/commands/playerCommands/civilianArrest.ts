import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import abilities from "../../core/abilities";

export default {
    data: new SlashCommandBuilder()
        .setName("civilianarrest")
        .setDescription("Start a civilian arrest on a player.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person to arrest.")
                .setRequired(true)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const result = await abilities.useAbility(interaction.user.id, "Civilian Arrest", {
            targetId: interaction.options.getUser("target").id,
        });
        if (!result.success)
            await interaction.editReply({
                content: result.message || "Failed to use civilian arrest.",
            });
        else
            await interaction.editReply({
                content: "Success.",
            });
    },
};
