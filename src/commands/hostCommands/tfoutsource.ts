import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import abilities from "../../core/abilities";

export default {
    data: new SlashCommandBuilder()
        .setName("tfoutsource")
        .setDescription("Invite someone to the Task Force.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person you intend to invite")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const result = await abilities.useAbility("Task Force", "Task Force Invite", {
            targetId: interaction.options.getUser("target").id,
            outsource: true,
        });
        if (!result.success)
            await interaction.editReply({
                content: result.message || "Failed to invite.",
            });
        else
            await interaction.editReply({
                content: "Success.",
            });
    },
};