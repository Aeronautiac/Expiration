import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import contacting from "../../core/contacting";

export default {
    data: new SlashCommandBuilder()
        .setName("setgroupchatname")
        .setDescription("Change the name of a group chat.")
        .addStringOption((option) =>
            option
                .setName("name")
                .setDescription("The new name for the group chat")
                .setRequired(true)
        ),
        
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const result = await contacting.setGroupchatName(
            interaction.user.id,
            interaction.options.getString("name"),
            interaction.channel.id
        );
        if (!result.success)
            await interaction.editReply({
                content:
                    result.message || "Failed to change name of group chat.",
            });
        else
            await interaction.editReply({
                content: result.message || "Success.",
            });
    },
};
