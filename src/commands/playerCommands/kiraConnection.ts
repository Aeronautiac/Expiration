import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import abilities from "../../core/abilities";
import { executionQueue } from "../../core/game";

export default {
    data: new SlashCommandBuilder()
        .setName("kiraconnection")
        .setDescription(
            "As 2nd Kira, you need to connect with Kira to unlock your Death Note."
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        await executionQueue.executeQueued(async () => {
            const result = await abilities.useAbility(
                interaction.user.id,
                "kiraConnection",
                {
                    channelId: interaction.channelId,
                }
            );
            if (!result.success)
                await interaction.editReply({
                    content: result.message || "Failed to use Kira connection.",
                });
            else
                await interaction.editReply({
                    content: "Success.",
                });
        });
    },
};
