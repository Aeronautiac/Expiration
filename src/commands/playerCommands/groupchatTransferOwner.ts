import { SlashCommandBuilder } from "discord.js";
import game from "../../game";
import { interaction } from "../../types";

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
    async execute(interaction: interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const newOwner = interaction.options.getUser("newowner");
        const reply = await game.changeGroupChatOwner(interaction.client, interaction.user, interaction.channel, newOwner);

        await interaction.editReply({
            content: reply,
            ephemeral: true,
        });
    },
};
