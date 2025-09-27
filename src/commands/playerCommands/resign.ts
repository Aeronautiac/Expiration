import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { OrganisationName } from "../../configs/organisations";
import { config } from "../../configs/config";
import orgs from "../../core/orgs";

export default {
    data: new SlashCommandBuilder()
        .setName("resign")
        .setDescription("Resign as the leader of an org.")
        .addStringOption((option) =>
            option
                .setName("newleaderid")
                .setDescription(
                    "The userid of the person you intend to pass leadership to."
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const guildId = interaction.guildId;
        let orgName: OrganisationName;
        for (const org of Object.keys(config.organisations)) {
            if (config.guilds[config.organisations[org].guild] === guildId) {
                orgName = org as OrganisationName;
                break;
            }
        }
        if (!orgName) {
            await interaction.editReply("This is not an organization server.");
            return;
        }

        const result = await orgs.leaderResign(
            interaction.user.id,
            orgName,
            interaction.options.getString("newleaderid")
        );
        if (!result.success)
            await interaction.editReply({
                content: result.message || "Failed to transfer leadship.",
            });
        else
            await interaction.editReply({
                content: "Success.",
            });
    },
};
