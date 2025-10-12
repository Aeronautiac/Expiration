import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import contacting from "../../core/contacting";
import { executionQueue } from "../../core/game";

export default {
    data: new SlashCommandBuilder()
        .setName("groupchatremove")
        .setDescription("Remove a user from the group chat.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription(
                    "The person you want to remove from the group chat"
                )
                .setRequired(true)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        await executionQueue.executeQueued(async () => {
            const result = await contacting.removeFromGroupchat(
                interaction.user.id,
                interaction.options.getUser("target").id,
                interaction.channel.id
            );
            if (!result.success)
                await interaction.editReply({
                    content:
                        result.message ||
                        "Failed to remove user from group chat.",
                });
            else
                await interaction.editReply({
                    content: result.message || "Success.",
                });
        });
    },
};
