import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import notebooks from "../../core/notebooks";

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

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const result = await notebooks.pass(
            interaction.user.id,
            interaction.guild.id,
            interaction.options.getString("userid")
        );
        if (!result.success)
            await interaction.editReply({
                content: result.message || "Failed to pass notebook.",
            });
        else
            await interaction.editReply({
                content: "Success.",
            });
    },
};
