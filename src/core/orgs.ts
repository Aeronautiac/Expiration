import { Client, Guild } from "discord.js";
import Organisation from "../models/organisation";
import { OrganisationName } from "../configs/organisations";
import { failure, Result, success } from "../types/Result";
import Player from "../models/player";
import access from "./access";
import { config } from "../configs/config";
import { GuildName } from "../configs/guilds";
import abilities from "./abilities";

let client: Client;

const orgs = {
    init(c: Client) {
        client = c;
    },

    async createDefaults() {
        await Organisation.create({ name: "Task Force" });
        await Organisation.create({ name: "Kira's Kingdom" });
        await abilities.initializeOrganisationAbilities("Task Force");
        await abilities.initializeOrganisationAbilities("Kira's Kingdom");
    },

    async blacklist(userId: string, name: OrganisationName) {
        Organisation.updateOne(
            { name },
            {
                $addToSet: { blacklist: userId },
            }
        );
    },

    async unblacklist(userId: string, name: OrganisationName) {
        Organisation.updateOne(
            { name },
            {
                $pull: { blacklist: userId },
            }
        );
    },

    async addToOrg(
        userId: string,
        name: OrganisationName,
        args: {
            og?: boolean;
            leader?: boolean;
            unblacklist?: boolean;
        }
    ): Promise<Result> {
        const userData = await Player.findOne({ userId });
        if (!userData) return failure("This person is not a player.");

        const org = await Organisation.findOne({ name });
        if (!org) return failure("This organisation has not been created yet.");

        const isBlacklisted = org.blacklist.includes(userId);
        if (isBlacklisted && !args.unblacklist)
            return failure(
                "This user is blacklisted from this org. If you wish to remove them from the blacklist, then set the unblacklist argument to true."
            );

        const oldLeader = org.leaderId;
        let leaderChanging = oldLeader && args.leader && oldLeader !== userId;

        // if user is already a member, then just update the existing org data to reflect the new arguments
        // otherwise, add them to the org
        if (org.memberIds.includes(userId)) {
            const update: Record<string, any> = {};

            // if they're og, then add them to the og members array, otherwise, remove them
            if (args.og && !org.ogMemberIds.includes(userId)) {
                update.$addToSet = { ogMemberIds: userId };
            } else if (!args.og && org.ogMemberIds.includes(userId)) {
                update.$pull = { ogMemberIds: userId };
            }

            // set as leader if they are meant to be the leader
            if (args.leader && org.leaderId !== userId)
                update.leaderId = userId;

            // if they are not being set as the leader, but they were the previous leader of the org, then the org no longer has a leader.
            if (org.leaderId === userId && !args.leader)
                update.$unset = { leaderId: "" };

            if (Object.keys(update).length > 0) {
                await Organisation.updateOne({ name }, update);
            }
        } else {
            if (isBlacklisted && args.unblacklist)
                await orgs.unblacklist(userId, name);

            // add them to org data and handle blacklist removal
            const addData: any = { $addToSet: { memberIds: userId } };
            if (args.og) addData.$addToSet.ogMemberIds = userId;
            if (args.leader) addData.leaderId = userId;
            await Organisation.updateOne({ name }, addData);

            // if they have no lounge blockers, then give them immediate access to the guild
            // if not, then it will be handled when they lose all their lounge blockers
            if (userData.loungeHiders.size === 0)
                await access.grantGroup(userId);
        }

        // update channel access
        await access.revokeChannels(userId);
        await access.grantChannels(userId);

        // if leader is changing, update old leader's channel access
        if (leaderChanging) {
            await access.revokeChannels(oldLeader);
            await access.grantChannels(oldLeader);
        }

        return success("Success.");
    },

    async removeFromOrg(
        userId: string,
        name: OrganisationName,
        blacklist?: boolean
    ): Promise<Result> {
        const userData = await Player.findOne({ userId });
        if (!userData) return failure("This person is not a player.");

        const org = await Organisation.findOne({ name });
        if (!org) return failure("This organisation has not been created yet.");

        // if user is not a member, return a failure
        if (!org.memberIds.includes(userId))
            return failure("This user is not a member of this organisation.");

        // remove them from org data, blacklist them if blacklist is true
        const update: Record<string, any> = {
            $pull: { memberIds: userId, ogMemberIds: userId },
        };
        if (userId === org.leaderId) update.$unset = { leaderId: "" };
        if (blacklist) await orgs.blacklist(userId, name);
        await Organisation.updateOne({ name }, update);

        // revoke access
        await access.revoke(
            userId,
            config.guilds[config.organisations[name].guild]
        );

        return success("Successfully removed user from org.");
    },

    async leaderResign(
        userId: string,
        orgName: OrganisationName,
        newLeaderId?: string
    ) {
        const userData = await Player.findOne({ userId });
        if (!userData) return failure("You are not a player.");

        const org = await Organisation.findOne({ name: orgName });
        if (!org) return failure("This organisation has not been created yet.");
        if (org.leaderId !== userId)
            return failure("You are not the leader of this org.");
        if (!org.memberIds.includes(userId))
            return failure("You are not a member of this org.");

        let newLeader: string;
        if (newLeaderId) {
            const targetData = await Player.findOne({ userId: newLeaderId });
            if (!targetData)
                return failure("The specified user is not a player.");
            if (!targetData.flags.get("alive"))
                return failure("The specified user is not alive.");
            if (!org.memberIds.includes(newLeaderId))
                return failure(
                    "The specified user is not a member of this org."
                );

            newLeader = newLeaderId;
        } else {
            const options = (await orgs.getLivingMembers(orgName)).filter(
                (a) => a !== userId
            );
            if (options.length === 0)
                return failure(
                    "You are the only person who can be the leader right now."
                );

            newLeader = options[Math.floor(Math.random() * options.length)];
        }

        // update org data
        await orgs.addToOrg(userId, orgName, {
            og: org.ogMemberIds.includes(userId),
            leader: false,
        });
        await orgs.addToOrg(newLeader, orgName, {
            og: org.ogMemberIds.includes(newLeader),
            leader: true,
        });

        return success();
    },

    async getLivingMembers(orgName: OrganisationName) {
        const orgData = await Organisation.findOne({ name: orgName });
        if (!orgData)
            throw new Error(
                `Org ${orgName} does not exist. Cannot fetch living members.`
            );
        const livingMembersPromises = orgData.memberIds.map(async (userId) => {
            const userData = await Player.findOne({ userId });
            if (userData && userData.flags.get("alive")) return userId;
        });
        const livingMembers = await Promise.all(livingMembersPromises);
        return livingMembers.filter((id) => id !== undefined);
    },

    // returns an array of userids for members that are able to vote
    async getVotingMembers(orgName: OrganisationName) {
        const orgData = await Organisation.findOne({ name: orgName });
        if (!orgData)
            throw new Error(
                `Org ${orgName} does not exist. Cannot fetch voting members.`
            );
        const votingMembersPromises = orgData.memberIds.map(async (userId) => {
            const userData = await Player.findOne({ userId });
            if (userData.loungeHiders.size === 0 && userData.flags.get("alive"))
                return userId;
        });
        const votingMembers = await Promise.all(votingMembersPromises);
        return votingMembers.filter((id) => id !== undefined);
    },
};

export default orgs;
