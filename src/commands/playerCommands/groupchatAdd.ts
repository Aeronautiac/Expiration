import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import contacting from "../../core/contacting";

export default {
    data: new SlashCommandBuilder()
        .setName("groupchatadd")
        .setDescription("Add a user to the group chat.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person you want to add to the group chat")
                .setRequired(true)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const result = await contacting.addToGroupchat(
            interaction.user.id,
            interaction.options.getUser("target").id,
            interaction.channel.id
        );
        if (!result.success)
            await interaction.editReply({
                content: result.message || "Failed to add user to group chat.",
            });
        else
            await interaction.editReply({
                content: result.message || "Success.",
            });
    },
};
