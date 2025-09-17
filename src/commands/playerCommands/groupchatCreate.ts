import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import contacting from "../../core/contacting";

export default {
    data: new SlashCommandBuilder()
        .setName("groupchatcreate")
        .setDescription("Create a group chat.")
        .addUserOption((option) =>
            option
                .setName("target1")
                .setDescription(
                    "The first person you want to add to the group chat"
                )
                .setRequired(true)
        )
        .addUserOption((option) =>
            option
                .setName("target2")
                .setDescription(
                    "The second person you want to add to the group chat"
                )
                .setRequired(true)
        )
        .addUserOption((option) =>
            option
                .setName("target3")
                .setDescription(
                    "The third person you want to add to the group chat"
                )
        )
        .addUserOption((option) =>
            option
                .setName("target4")
                .setDescription(
                    "The fourth person you want to add to the group chat"
                )
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const m1 = interaction.options.getUser("target1");
        const m2 = interaction.options.getUser("target2");
        const m3 = interaction.options.getUser("target3");
        const result = await contacting.createGroupchat(interaction.user.id, [
            m1.id,
            m2.id,
            m3.id,
        ]);
        if (!result.success)
            await interaction.editReply({
                content: result.message || "Failed to create group chat.",
            });
        else
            await interaction.editReply({
                content: result.message || "Success.",
            });
    },
};
