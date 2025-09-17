import { Client, Guild } from "discord.js";
import Organisation from "../models/organisation";
import { OrganisationName } from "../configs/organisations";
import { failure, Result, success } from "../types/Result";
import Player from "../models/player";
import access from "./access";
import { config } from "../configs/config"
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

    async addToOrg(
        userId: string,
        name: OrganisationName,
        leader?: boolean
    ): Promise<Result> {
        const userData = await Player.findOne({ userId });
        if (!userData) return failure("This person is not a player.");

        const org = await Organisation.findOne({ name });
        if (!org) return failure("This organisation has not been created yet.");

        // if user is already a member, return a failure
        if (org.memberIds.includes(userId))
            return failure("This user is already part of this organisation.");

        // add them to org data
        await Organisation.updateOne(
            { name },
            {
                $addToSet: { memberIds: userId },
                leaderId: leader ? userId : org.leaderId,
            }
        );

        // if they have no lounge blockers, then give them immediate access to the guild
        // if not, then it will be handled when they lose all their lounge blockers
        if (userData.loungeHiders.size === 0) await access.grantGroup(userId);

        return success("Successfully added user to org.");
    },

    async removeFromOrg(userId: string, name: OrganisationName): Promise<Result> {
        const userData = await Player.findOne({ userId });
        if (!userData) return failure("This person is not a player.");

        const org = await Organisation.findOne({ name });
        if (!org) return failure("This organisation has not been created yet.");

        // if user is not a member, return a failure
        if (!org.memberIds.includes(userId))
            return failure("This user is not a member of this organisation.");

        // remove them from org data
        await Organisation.updateOne(
            { name },
            {
                $pull: { memberIds: userId },
                leaderId: userId === org.leaderId ? undefined : org.leaderId,
            }
        );

        // revoke access
        const guilds = config.organisations[name].guilds;
        const promises = guilds.map(async (guild: GuildName) => {
            await access.revoke(userId, config.guilds[guild]);
        })
        await Promise.allSettled(promises);

        return success("Successfully removed user from org.");
    },

    async getLivingMembers(orgName: OrganisationName) {
        const orgData = await Organisation.findOne({ name: orgName });
        if (!orgData) throw new Error(`Org ${orgName} does not exist. Cannot fetch living members.`);
        const livingMembersPromises = orgData.memberIds.map(async (userId) => {
            const userData = await Player.findOne({ userId });
            if (userData && userData.flags.get("alive"))
                return userId;
        });
        const livingMembers = await Promise.all(livingMembersPromises);
        return livingMembers;
    },

    // returns an array of userids for members that are able to vote
    async getVotingMembers(orgName: OrganisationName) {
        const orgData = await Organisation.findOne({ name: orgName });
        if (!orgData) throw new Error(`Org ${orgName} does not exist. Cannot fetch voting members.`);
        const votingMembersPromises = orgData.memberIds.map(async (userId) => {
            const userData = await Player.findOne({ userId });
            if (userData.loungeHiders.size === 0 && userData.flags.get("alive"))
                return userId;
        });
        const votingMembers = await Promise.all(votingMembersPromises);
        return votingMembers;
    },

    getGuildIds(orgName: OrganisationName) {
        const guilds = config.organisations[orgName].guilds;
        const ids = guilds.map((guildName: GuildName) => {
            return config.guilds[guildName];
        });
        return ids;
    }
};

export default orgs;
