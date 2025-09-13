import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import abilities from "../../core/abilities";
import { AbilityName } from "../../configs/abilityArgs";

export default {
    data: new SlashCommandBuilder()
        .setName("eyes")
        .setDescription("Use your shinigami eyes on someone.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription(
                    "Who do you want to use your shinigami eyes on?"
                )
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("usefor")
                .setDescription(
                    "What do you want to use your shinigami eyes for?"
                )
                .setRequired(true)
                .addChoices(
                    {
                        name: "Reveal a player's true name.",
                        value: "nameReveal",
                    },
                    {
                        name: "Check if a player currently posesses a notebook.",
                        value: "notebookReveal",
                    }
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const useFor = interaction.options.getString("usefor") as AbilityName;
        const result = await abilities.useAbility(interaction.user.id, useFor, {
            targetId: interaction.options.getUser("target").id,
        });
        if (!result.success)
            await interaction.editReply({
                content: result.message || "Failed to use eyes.",
            });

        await interaction.editReply({
            content: "Success.",
        });
    },
};
