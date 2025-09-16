import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import orgs from "../../core/orgs";
import { OrganisationName } from "../../configs/organisations";
import { config } from "../../configs/config";
import util from "../../core/util";

export default {
    data: new SlashCommandBuilder()
        .setName("addtoorg")
        .setDescription("Add a member to an organisation.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person to add to the organisation")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("organisation")
                .setDescription("The organisation to add them to")
                .setRequired(true)
                .addChoices(
                    ...(Object.keys(config.organisations).map(util.interactionChoice))
                )
        )
        .addBooleanOption(option =>
            option
                .setName("leader")
                .setDescription("Whether or not they are the leader of the organisation")
                .setRequired(false)
        ),
        // .addBooleanOption(option =>
        //     option
        //         .setName("og")
        //         .setDescription("Whether or not they are considered an og member")
        //         .setRequired(false)
        // ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        await orgs.addToOrg(interaction.options.getUser("target").id, interaction.options.getString("organisation") as OrganisationName, interaction.options.getBoolean("leader"));

        await interaction.editReply({
            content: "Success.",
        });
    },
};
