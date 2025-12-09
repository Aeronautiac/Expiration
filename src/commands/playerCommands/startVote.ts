import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import util from "../../core/util";
import {
    organisationAbilities,
    OrganisationAbilityName,
} from "../../configs/organisationAbilities";
import { config } from "../../configs/config";
import { OrganisationName } from "../../configs/organisations";
import orgs from "../../core/orgs";
import Organisation from "../../models/organisation";
import abilities from "../../core/abilities";
import { AbilityName } from "../../configs/abilityArgs";
import polls from "../../core/polls";
import {
    memberAbilities,
    loungeNumberAbilities,
    targetAbilities,
} from "../../core/organisationAbilities";
import { executionQueue } from "../../core/game";

export default {
    data: new SlashCommandBuilder()
        .setName("startvote")
        .setDescription(
            "Start a vote and do something if it succeeds in your organization"
        )
        .addStringOption((option) =>
            option
                .setName("action")
                .addChoices(
                    ...Array.from(Object.keys(organisationAbilities)).map(
                        util.interactionChoice
                    )
                )
                .setDescription("The action to start a vote for")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option.setName("targetid").setDescription("The target's user id")
        )
        .addStringOption((option) =>
            option
                .setName("memberid")
                .setDescription(
                    "The user id of the person used to perform the action"
                )
        )
        .addIntegerOption((option) =>
            option
                .setName("loungenumber")
                .setDescription("The lounge number you want to tap into")
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });
        const options = interaction.options;

        // which org is trying to start a vote?
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

        // is the person starting the vote part of the org?
        const userId = interaction.user.id;
        const orgData = await Organisation.findOne({ name: orgName });
        if (!orgData.memberIds.includes(userId)) {
            await interaction.editReply(
                "You are not a member of this organization."
            );
            return;
        }

        // did they give the right amount of data required for the ability?
        const ability = options.getString("action") as OrganisationAbilityName;

        // requires target
        const targetId = options.getString("targetid");
        if (!targetId && targetAbilities.has(ability)) {
            await interaction.editReply("This ability requires a target.");
            return;
        }

        // requires an org member
        const memberId = options.getString("memberid");
        const kidnapperId = memberId;
        if (!memberId && memberAbilities.has(ability)) {
            await interaction.editReply("This ability requires a member id.");
            return;
        }

        // requires a lounge number
        const loungeNumber = options.getInteger("loungenumber");
        if (loungeNumber === undefined && loungeNumberAbilities.has(ability)) {
            await interaction.editReply(
                "This ability requires a lounge number."
            );
            return;
        }

        // can they use the ability?
        await executionQueue.executeQueued(async () => {
            const canUseResult = await abilities.canUseAbility(
                orgName,
                ability as AbilityName,
                {
                    targetId,
                    loungeNumber,
                    kidnapperId,
                    memberId,
                }
            );
            if (!canUseResult.success) {
                interaction.editReply(
                    canUseResult.message || `Cannot use ability ${ability}.`
                );
                return;
            }

            // ability can currently be used, it is safe to start the vote.
            interaction.editReply("Vote started.");

            // poll message
            let pollMessage = `@everyone A vote has been started by <@${userId}> to use ability **${ability}**.`;
            if (targetId && targetAbilities.has(ability))
                pollMessage += `\nTarget: <@${targetId}>`;
            if (memberId && memberAbilities.has(ability))
                pollMessage += `\nMember Used: <@${kidnapperId}>`;
            if (loungeNumber && loungeNumberAbilities.has(ability))
                pollMessage += `\nLounge number: **${loungeNumber}**`;

            // create the poll
            await polls.create(
                {
                    messageContent: pollMessage,
                    channelId: interaction.channelId,
                },
                ability,
                {
                    threshold: "orgMajority",
                    canContinue: "orgAbility",
                    resolve: "orgAbility",
                    filter: "validOrgVoter",
                },
                {
                    startedBy: interaction.user.id,
                    orgName,
                    targetId,
                    loungeNumber,
                    kidnapperId,
                    memberId,
                },
                {
                    resolvesOnThreshold: true,
                    prioritizeInconclusive: true,
                    resolveAt:
                        Date.now() + util.hrsToMs(config.orgPollDuration),
                }
            );
        });
    },
};
