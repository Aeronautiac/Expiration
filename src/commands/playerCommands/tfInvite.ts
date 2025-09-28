import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { OrganisationName } from "../../configs/organisations";
import { config } from "../../configs/config";
import abilities from "../../core/abilities";

export default {
    data: new SlashCommandBuilder()
        .setName("tfinvite")
        .setDescription("Invite someone to the Task Force.")
        .addStringOption((option) =>
            option
                .setName("targetid")
                .setDescription("The userid of the person you intend to invite")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("truename")
                .setDescription(
                    "The true name of the person you intend to invite"
                )
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const guildId = interaction.guildId;
        if (guildId !== config.guilds[config.organisations["Task Force"].guild]) {
            await interaction.editReply("This is not the Task Force server.");
            return;
        }

        const result = await abilities.useAbility("Task Force", "Task Force Invite", {
            userId: interaction.user.id,
            trueName: interaction.options.getString("truename"),
            targetId: interaction.options.getString("targetid"),
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
