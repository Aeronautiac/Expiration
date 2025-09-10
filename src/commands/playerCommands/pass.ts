// creates notebook data for the channel the command is written in. the channel will behave as a death note.
import { SlashCommandBuilder } from "discord.js";
import game from "../../game";
import { interaction } from "../../types";

export default {
    data: new SlashCommandBuilder()
        .setName("pass")
        .setDescription("Pass a notebook to someone else until the next day.")
        .addStringOption((option) =>
            option
                .setName("userid")
                .setDescription(
                    "The userid of the person you intend to pass the notebook to."
                )
                .setRequired(true)
        ),

    async execute(interaction: interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const result = await game.passNotebook(
            interaction.client,
            interaction.guild,
            interaction.user.id,
            interaction.options.getString("userid")
        );

        if (result !== true) {
            await interaction.editReply({
                content: result,
                ephemeral: true,
            });
            return;
        }

        await interaction.editReply({
            content: "Success.",
            ephemeral: true,
        });
    },
};
