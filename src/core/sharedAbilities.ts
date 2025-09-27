import { Client, roleMention } from "discord.js";
import { DiscordRoleName } from "../configs/discordRoles";
import { failure, Result, success } from "../types/Result";
import { SharedAbilityArgs } from "../configs/abilityArgs";
import Organisation from "../models/organisation";
import Player from "../models/player";
import game from "./game";
import { config } from "../configs/config";
import polls from "./polls";
import util from "./util";
import { OrganisationName } from "../configs/organisations";
import Season from "../models/season";

let client: Client;

const sharedAbilities = {
    init(c: Client) {
        client = c;
    },

    async civilianArrestCheck(
        owner: string,
        args: SharedAbilityArgs["Civilian Arrest"]
    ) {
        const season = await Season.findOne({});
        if (season.flags.get("blackout"))
            return failure("Cannot civilian arrest during a blackout.");
        const targetData = await Player.findOne({ userId: args.targetId });
        if (!targetData) return failure("The target is not a valid player.");
        if (!targetData.flags.get("alive"))
            return failure("The target is dead.");
        if (
            targetData.flags.get("incarcerated") ||
            targetData.flags.get("ipp") ||
            targetData.flags.get("kidnapped")
        )
            return failure("Cannot civilian arrest this person at the moment.");

        return success();
    },

    async civilianArrest(
        owner: string,
        args: SharedAbilityArgs["Civilian Arrest"],
        checkOnly?: boolean
    ) {
        const checkResult = await sharedAbilities.civilianArrestCheck(
            owner,
            args
        );
        if (!checkResult.success) return checkResult;

        if (checkOnly) return success();

        // message stuff
        const playerData = await Player.findOne({ userId: owner });
        const arresterDisplay = playerData
            ? util.roleMention(playerData.role)
            : util.orgMention(owner as OrganisationName);
        let message = `@everyone the ${arresterDisplay} has started a civilian arrest on <@${args.targetId}>.`;
        message += `\nPlease vote whether or not you wish for this person to be arrested or not. They will be <@&${config.discordRoles.Incarcerated}> for ${config.civArrestDuration} hours if the vote is successful.`;
        message += `\nThe vote will be open for ${config.civArrestVoteDuration} hours unless something is to happen which would render the ability unusable.`;

        // create poll
        await polls.create(
            {
                messageContent: message,
                channelId: config.channels.news,
            },
            "civilianArrest",
            {
                resolve: "civArrest",
                threshold: "civMajority",
                filter: "validCivVoter",
                canContinue: "civArrest",
            },
            {
                targetId: args.targetId,
                arrester: owner,
            },
            {
                resolveAt:
                    Date.now() + util.hrsToMs(config.civArrestVoteDuration),
                prioritizeInconclusive: false,
                resolvesOnThreshold: false,
            }
        );

        return success();
    },
};

export default sharedAbilities;
