import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";
import orgs from "../../core/orgs";
import { OrganisationName } from "../../configs/organisations";
import { config } from "../../configs/config";
import util from "../../core/util";

export default {
    data: new SlashCommandBuilder()
        .setName("removefromorg")
        .setDescription("Remove a member from an organisation.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person to remove from the organisation")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("organisation")
                .setDescription("The organisation to remove them from")
                .setRequired(true)
                .addChoices(
                    ...Object.keys(config.organisations).map(
                        util.interactionChoice
                    )
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        await orgs.removeFromOrg(
            interaction.options.getUser("target").id,
            interaction.options.getString("organisation") as OrganisationName
        );

        await interaction.editReply({
            content: "Success.",
        });
    },
};
