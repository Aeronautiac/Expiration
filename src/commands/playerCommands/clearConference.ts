import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import contacting from "../../core/contacting";
import { executionQueue } from "../../core/game";

export default {
    data: new SlashCommandBuilder()
        .setName("clearconference")
        .setDescription("Removes all players from the conference."),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        await executionQueue.executeQueued(async () => {
            const result = await contacting.removeFromConference(
                interaction.user.id,
                [],
                interaction.channelId
            );
            if (!result.success)
                await interaction.editReply({
                    content:
                        result.message || "Failed to clear Press Conference.",
                });
            else
                await interaction.editReply({
                    content: "Success.",
                });
        });
    },
};
