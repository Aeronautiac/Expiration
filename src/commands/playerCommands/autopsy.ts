import { SlashCommandBuilder } from "discord.js";
import game from "../../game";

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
    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        // do the thing here
        const result = await game.autopsy(interaction);

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
