import { SlashCommandBuilder } from "discord.js";
import game from "../../game";
import { interaction } from "../../types";

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
                    { name: "Reveal a player's true name.", value: "name" },
                    {
                        name: "Check if a player currently posesses a notebook.",
                        value: "notebook",
                    }
                )
        ),

    async execute(interaction: interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        // do the thing here
        const result = await game.eyes(interaction);

        if (result !== true) {
            await interaction.editReply({
                content: result,
                ephemeral: true,
            });
        } else {
            await interaction.editReply({
                content: "Success.",
                ephemeral: true,
            });
        }
    },
};
