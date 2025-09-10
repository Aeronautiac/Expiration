import { SlashCommandBuilder } from "discord.js";
import game from "../../game";
import { interaction } from "../../types";

export default {
    data: new SlashCommandBuilder()
        .setName("groupchatcreate")
        .setDescription("Create a group chat.")
        .addUserOption((option) =>
            option
                .setName("target1")
                .setDescription("The first person you want to add to the group chat")
                .setRequired(true)
        )
        .addUserOption((option) =>
            option
                .setName("target2")
                .setDescription("The second person you want to add to the group chat")
                .setRequired(true)
        )
        .addUserOption((option) =>
            option
                .setName("target3")
                .setDescription("The third person you want to add to the group chat")
        )
        .addUserOption((option) =>
            option
                .setName("target4")
                .setDescription("The fourth person you want to add to the group chat")
        ),
    async execute(interaction: interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const reply = await game.createGroupChat(
            interaction.client,
            interaction.user,
            [
                interaction.options.getUser("target1"),
                interaction.options.getUser("target2"),
                interaction.options.getUser("target3"),
                interaction.options.getUser("target4"),
            ]
        );

        await interaction.editReply({
            content: reply,
            ephemeral: true,
        });
    },
};
