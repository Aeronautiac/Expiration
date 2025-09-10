import { SlashCommandBuilder } from "discord.js";
import game from "../../game";
import { interaction } from "../../types";

export default {
    data: new SlashCommandBuilder()
        .setName("groupchatnamechange")
        .setDescription("Change the name of the group chat.")
        .addStringOption((option) =>
            option
                .setName("newname")
                .setDescription("The new name for the group chat")
                .setRequired(true)
        ),
    async execute(interaction: interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const newName = interaction.options.getString("newname");
        const reply = await game.changeGroupChatName(interaction.client, interaction.user, interaction.channel, newName);

        await interaction.editReply({
            content: reply,
            ephemeral: true,
        });
    },
};
