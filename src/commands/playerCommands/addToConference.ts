import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import contacting from "../../core/contacting";
import { executionQueue } from "../../core/game";

export default {
    data: new SlashCommandBuilder()
        .setName("addtoconference")
        .setDescription("Add user(s) to the conference.")
        .addUserOption((option) =>
            option
                .setName("target1")
                .setDescription(
                    "The 1st person you want to add to the conference"
                )
                .setRequired(true)
        )
        .addUserOption((option) =>
            option
                .setName("target2")
                .setDescription(
                    "The 2nd person you want to add to the conference"
                )
        )
        .addUserOption((option) =>
            option
                .setName("target3")
                .setDescription(
                    "The 3rd person you want to add to the conference"
                )
        )
        .addUserOption((option) =>
            option
                .setName("target4")
                .setDescription(
                    "The 4th person you want to add to the conference"
                )
        )
        .addUserOption((option) =>
            option
                .setName("target5")
                .setDescription(
                    "The 5th person you want to add to the conference"
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
        const m5 = interaction.options.getUser("target5");
        const members = [m1?.id, m2?.id, m3?.id, m4?.id, m5?.id].filter(
            (entry) => Boolean(entry)
        );

        await executionQueue.executeQueued(async () => {
            const result = await contacting.addToConference(
                interaction.user.id,
                members,
                interaction.channelId
            );
            if (!result.success)
                await interaction.editReply({
                    content:
                        result.message ||
                        "Failed to add user to Press Conference.",
                });
            else
                await interaction.editReply({
                    content: "Success.",
                });
        });
    },
};
