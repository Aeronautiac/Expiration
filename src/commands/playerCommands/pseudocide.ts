import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import abilities from "../../core/abilities";
import { RoleName } from "../../configs/roles";
import { config } from "../../configs/config";
import util from "../../core/util";
import { OrgMember } from "../../types/OrgMember";
import { Organisation } from "../../types/configTypes";
import { OrganisationName } from "../../configs/organisations";

function choice(name: string) {
    return {
        name: name,
        value: name,
    };
}

export default {
    data: new SlashCommandBuilder()
        .setName("pseudocide")
        .setDescription("Pseudocide a player.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person to pseudocide.")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("truename")
                .setDescription("The true name to be displayed.")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("role")
                .setDescription("The role to be displayed.")
                .addChoices(
                    ...Object.keys(config.roles).map(util.interactionChoice)
                )
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("organisations")
                .setDescription(
                    `Separate with "," (Task Force, Kira's Kingdom). If leader, start with L_ (L_Task Force)`
                )
                .setRequired(false)
        )
        .addBooleanOption((option) =>
            option
                .setName("hasnotebook")
                .setDescription(
                    "Whether the death message should say they had a notebook or not."
                )
                .setRequired(false)
        )
        .addBooleanOption((option) =>
            option
                .setName("hasbugability")
                .setDescription(
                    "Whether the death message should say they had the bug and contact logs abilities or not."
                )
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("deathmessage")
                .setDescription("The death message to be displayed.")
                .setRequired(false)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const options = interaction.options;
        const role = options.getString("role") as RoleName;

        // create organisation member array and validate input
        const memberObjects: OrgMember[] = [];
        const orgInput = options.getString("organisations");
        const orgStrings = orgInput
            ? orgInput.split(",").map((s) => s.trim())
            : [];
        for (const str of orgStrings) {
            const leader = str.startsWith("L_");
            const orgName = util.toTitleCase(
                (leader ? str.slice(2) : str).replace(/_/g, " ")
            );
            const orgConfig: Organisation | undefined =
                config.organisations[orgName];

            // if this org doesn't exist, exit early
            if (!orgConfig) {
                await interaction.editReply({
                    content: `Organisation **${orgName}** does not exist.`,
                });
                return;
            }

            // if they specified this person as the leader and this org cannot have a leader, then exit early
            if (leader && !orgConfig.rankNames.leader) {
                await interaction.editReply({
                    content: `Organisation **${orgName}** can not have a leader.`,
                });
                return;
            }

            // create member objects
            memberObjects.push({
                org: orgName as OrganisationName,
                leader,
            });
        }

        const result = await abilities.useAbility(
            interaction.user.id,
            "pseudocide",
            {
                targetId: options.getUser("target").id,
                role: role,
                trueName: options.getString("truename"),
                hasBugAbility: options.getBoolean("hasbugability"),
                hasNotebook: options.getBoolean("hasnotebook"),
                message: options.getString("deathmessage"),
                memberObjects,
            }
        );
        if (!result.success)
            await interaction.editReply({
                content: result.message || "Failed to use pseudocide.",
            });
        else
            await interaction.editReply({
                content: "Success.",
            });
    },
};
