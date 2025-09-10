import { SlashCommandBuilder } from "discord.js";
import game from "../../game";
import { interaction } from "../../types";

export default {
    data: new SlashCommandBuilder()
        .setName("groupchatremove")
        .setDescription("Remove a user from the group chat.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person you want to remove from the group chat")
                .setRequired(true)
        ),
    async execute(interaction: interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });
        
        const target = interaction.options.getUser("target");
        const reply = await game.removeUserFromGroupChat(interaction.client, interaction.user, target, interaction.channel);

        await interaction.editReply({
            content: reply,
            ephemeral: true,
        });
    },
};
