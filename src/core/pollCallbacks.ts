import { AbilityName } from "../configs/abilityArgs";
import {
    organisationAbilities,
    OrganisationAbilityName,
} from "../configs/organisationAbilities";
import { OrganisationName } from "../configs/organisations";
import abilities from "./abilities";
import orgs from "./orgs";
import Organisation from "../models/organisation";
import Player from "../models/player";
import { IPoll, PollResolutionReason } from "../models/poll";
import { Client, TextChannel } from "discord.js";
import game from "./game";
import { config } from "../configs/config";
import sharedAbilities from "./sharedAbilities";

let client: Client;

const pollCallbacks = {
    init(c: Client) {
        client = c;
    },

    resolve: {
        // if accepted, use the org ability, else, display a rejection message depending on the resolution reason
        async orgAbility(poll: IPoll, resolution: PollResolutionReason) {
            const orgName = poll.data["orgName"] as OrganisationName;
            const abilityName = poll.identifier as OrganisationAbilityName;
            const targetId = poll.data["targetId"] as string | null;
            const loungeNumber = poll.data["loungeNumber"] as number | null;
            const kidnapperId = poll.data["kidnapperId"] as string | null;
            const pollChannel = (await client.channels.fetch(
                poll.location.channelId
            )) as TextChannel;
            if (!pollChannel) return;
            const pollMessage = await pollChannel.messages.fetch(
                poll.location.messageId
            );
            if (!pollMessage) return;

            switch (resolution) {
                case "accepted":
                    console.log("accepted");
                    await pollMessage.reply(
                        "The vote has succeeded. The action will now be performed."
                    );
                    await abilities.useAbility(
                        orgName,
                        abilityName as AbilityName,
                        {
                            targetId,
                            loungeNumber,
                            kidnapperId,
                        }
                    );

                    break;
                case "rejected":
                    console.log("rejected");
                    await pollMessage.reply(
                        "The vote has been rejected. The action will not be performed."
                    );
                    break;
                case "inconclusive":
                    console.log("inconclusive");
                    await pollMessage.reply(
                        "The vote was inconclusive. The action will not be performed."
                    );
                    break;
                case "cancelled":
                    console.log("cancelled");
                    await pollMessage.reply(
                        "The vote was cancelled. The action will not be performed."
                    );
                    break;
            }
        },

        async civArrest(poll: IPoll, resolution: PollResolutionReason) {
            const targetId = poll.data["targetId"] as string | null;
            const pollChannel = (await client.channels.fetch(
                poll.location.channelId
            )) as TextChannel;
            if (!pollChannel) return;
            const pollMessage = await pollChannel.messages.fetch(
                poll.location.messageId
            );
            if (!pollMessage) return;

            switch (resolution) {
                case "accepted":
                    console.log("accepted");
                    await pollMessage.reply(
                        "@everyone The vote has succeeded. The civilian arrest will now be performed."
                    );

                    await game.incarcerate(targetId, {
                        duration: config.civArrestDuration,
                        message: `<@${targetId}> will now be <@&${config.discordRoles.Incarcerated}> for ${config.civArrestDuration} hours.`,
                    });

                    break;
                case "rejected":
                    console.log("rejected");
                    await pollMessage.reply(
                        "@everyone The vote has been rejected. The civilian arrest will not be performed."
                    );
                    break;
                case "inconclusive":
                    console.log("inconclusive");
                    await pollMessage.reply(
                        "@everyone The vote was inconclusive. The civilian arrest will not be performed."
                    );
                    break;
                case "cancelled":
                    console.log("cancelled");
                    await pollMessage.reply(
                        "@everyone The vote was cancelled. The civilian arrest will not be performed."
                    );
                    break;
            }
        },
    },

    filter: {
        // they should be a living member, and they should be able to see the lounge and vote.
        async validOrgVoter(poll: IPoll, userId: string) {
            const org: OrganisationName = poll.data.orgName as OrganisationName;
            const orgData = await Organisation.findOne({ name: org });
            const isMember = orgData.memberIds.includes(userId);
            // if no lounge hiders, then there should be nothing stopping the person from voting
            const userData = await Player.findOne({ userId });
            if (!userData) return false;
            const hasBlockers = userData.loungeHiders.size > 0;
            return isMember && !hasBlockers;
        },

        async validCivVoter(poll: IPoll, userId: string) {
            // if they are able to see news, and they are alive, then they should be able to vote.
            const userData = await Player.findOne({ userId });
            if (!userData) return false;
            return userData.flags.get("alive");
        },
    },

    threshold: {
        // majority of members that are able to vote
        async orgMajority(poll: IPoll) {
            const org: OrganisationName = poll.data.orgName as OrganisationName;
            const votingMembers = await orgs.getVotingMembers(org);
            return Math.floor(votingMembers.length / 2) + 1;
        },

        async civMajority(poll: IPoll) {
            const allLivingPlayers = await Player.find({ "flags.alive": true });
            return Math.floor(allLivingPlayers.length / 2) + 1;
        },
    },

    canContinue: {
        // can the ability still be used by the org with the supplied params at this point in time?
        async orgAbility(poll: IPoll) {
            const orgName = poll.data["orgName"] as OrganisationName;
            const abilityName = poll.identifier as OrganisationAbilityName;
            const targetId = poll.data["targetId"] as string | null;
            const loungeNumber = poll.data["loungeNumber"] as number | null;
            const kidnapperId = poll.data["kidnapperId"] as string | null;

            const canUse = await abilities.canUseAbility(
                orgName,
                abilityName as AbilityName,
                {
                    targetId,
                    loungeNumber,
                    kidnapperId,
                }
            );
            return canUse.success;
        },

        // civ arrest
        async civArrest(poll: IPoll) {
            const arrester = poll.data["arrester"] as string | null;
            const targetId = poll.data["targetId"] as string | null;
            const canUse = await abilities.useAbility(
                arrester,
                "Civilian Arrest",
                { targetId },
                true,
                ["charges", "cooldown"]
            );
            return canUse.success;
        },
    },
};

export default pollCallbacks;
