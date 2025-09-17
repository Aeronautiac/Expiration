import { OrganisationName } from "./configs/organisations";
import orgs from "./core/orgs";
import Organisation from "./models/organisation";
import Player from "./models/player";
import { IPoll } from "./models/poll";

const pollCallbacks = {
    resolve: {
        // if accepted, use the org ability, else, display a rejection message depending on the resolution reason
        async orgAbility(poll: IPoll) {

        }
    },

    filter: {
        // they should be a living member, and they should be able to see the lounge and vote.
        async validOrgVoter(poll: IPoll, userId: string) {
            const org: OrganisationName = poll.data.orgName as OrganisationName;
            const orgData = await Organisation.findOne({ name: org });
            const isMember = orgData.memberIds.includes(userId);
            // if no lounge hiders, then there should be nothing stopping the person from voting
            const userData = await Player.findOne({ userId });
            const hasBlockers = userData.loungeHiders.size > 0;
            return isMember && !hasBlockers;
        }
    },

    threshold: {
        // majority of members that are able to vote
        async orgMajority(poll: IPoll) {
            const org: OrganisationName = poll.data.orgName as OrganisationName;
            const votingMembers = await orgs.getVotingMembers(org);
            return Math.floor(votingMembers.length / 2) + 1;
        }
    },

    canContinue: {
        // can the ability still be used by the org with the supplied params at this point in time?
        async orgAbility(poll: IPoll) {

        }
    }
}

export default pollCallbacks;
