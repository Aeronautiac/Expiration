import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { OrganisationName } from "../../configs/organisations";
import { config } from "../../configs/config";
import orgs from "../../core/orgs";
import orgAbilities from "../../core/organisationAbilities";
import abilities from "../../core/abilities";

export default {
    data: new SlashCommandBuilder()
        .setName("tfkick")
        .setDescription("Kick someone from the Task Force.")
        .addStringOption((option) =>
            option
                .setName("targetid")
                .setDescription("The userid of the person you intend to kick")
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const guildId = interaction.guildId;
        let orgName: OrganisationName = "Task Force";
        if (guildId !== config.guilds[config.organisations["Task Force"].guild]) {
            await interaction.editReply("This is not the Task Force server.");
            return;
        }

        const result = await abilities.useAbility(orgName, "Task Force Kick", {
            userId: interaction.user.id,
            targetId: interaction.options.getString("targetid"),
        });
        if (!result.success)
            await interaction.editReply({
                content: result.message || "Failed to kick.",
            });
        else
            await interaction.editReply({
                content: "Success.",
            });
    },
};
