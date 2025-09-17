import { OrganisationName } from "./configs/organisations";
import Organisation from "./models/organisation";
import Player from "./models/player";
import { IPoll } from "./models/poll";

const pollCallbacks = {
    resolve: {
        
    },

    filter: {
        // they should be a living member, and they should be able to see the lounge and vote.
        async validOrgVoter(poll: IPoll, userId: string) {
            const org: OrganisationName = poll.data.orgName as OrganisationName;
            const orgData = await Organisation.findOne({ name: org });
            const isMember = orgData.memberIds.includes(userId);
            // if no lounge hiders, then there should be nothing stopping the person from voting
            const userData = await Player.findOne({userId});
            const hasBlockers = userData.loungeHiders.size > 0;
            
            return isMember && !hasBlockers;
        }
    },

    threshold: {
        async orgMajority() {

        }
    },

    canContinue: {
        
    }
}

export default pollCallbacks;
