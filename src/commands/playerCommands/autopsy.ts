import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import abilities from "../../core/abilities";

export default {
    data: new SlashCommandBuilder()
        .setName("autopsy")
        .setDescription("Autopsy a player.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person to perform an autopsy on.")
                .setRequired(true)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        // do the thing here
        const result = await abilities.useAbility(
            interaction.user.id,
            "autopsy",
            { targetId: interaction.options.getUser("target").id }
        );
        if (!result.success)
            await interaction.editReply({
                content: result.message || "Failed to use autopsy.",
            });

        await interaction.editReply({
            content: "Success.",
        });
    },
};
