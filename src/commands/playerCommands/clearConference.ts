import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import contacting from "../../core/contacting";

export default {
    data: new SlashCommandBuilder()
        .setName("clearconference")
        .setDescription("Removes all players from the conference."),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const result = await contacting.removeFromConference(interaction.user.id, [], interaction.channelId);
        if (!result.success)
            await interaction.editReply({
                content: result.message || "Failed to clear Press Conference.",
            });
        else
            await interaction.editReply({
                content: "Success.",
            });
    },
};
