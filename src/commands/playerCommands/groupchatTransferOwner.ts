import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import contacting from "../../core/contacting";

export default {
    data: new SlashCommandBuilder()
        .setName("groupchattransferowner")
        .setDescription("Transfer ownership of the group chat.")
        .addUserOption((option) =>
            option
                .setName("newowner")
                .setDescription("The new owner of the group chat")
                .setRequired(true)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const result = await contacting.changeGroupchatOwner(
            interaction.user.id,
            interaction.options.getUser("newowner").id,
            interaction.channel.id
        );
        if (!result.success)
            await interaction.editReply({
                content:
                    result.message || "Failed to change owner of group chat.",
            });
        else
            await interaction.editReply({
                content: result.message || "Success.",
            });
    },
};
