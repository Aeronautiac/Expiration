import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import contacting from "../../core/contacting";
import { executionQueue } from "../../core/game";

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
        const m4 = interaction.options.getUser("target4");
        const members = [m1?.id, m2?.id, m3?.id, m4?.id].filter((entry) =>
            Boolean(entry)
        );
        
        await executionQueue.executeQueued(async () => {
            const result = await contacting.createGroupchat(
                interaction.user.id,
                members
            );
            if (!result.success)
                await interaction.editReply({
                    content: result.message || "Failed to create group chat.",
                });
            else
                await interaction.editReply({
                    content: result.message || "Success.",
                });
        });
    },
};
