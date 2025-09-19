import { Client, TextChannel } from "discord.js";
import { OrganisationAbilityName } from "../configs/organisationAbilities";
import { OrganisationName } from "../configs/organisations";
import { OrganisationAbilityArgs } from "../configs/abilityArgs";
import Player from "../models/player";
import { failure, success } from "../types/Result";
import { config } from "../configs/config";
import names from "./names";
import Organisation from "../models/organisation";
import game from "./game";
import Season from "../models/season";

export const kidnapperAbilities: Set<OrganisationAbilityName> = new Set();
kidnapperAbilities.add("Public Kidnap");

export const targetAbilities: Set<OrganisationAbilityName> = new Set();
targetAbilities
    .add("2nd Kira+Kira Anonymous Kidnap")
    .add("Anonymous Kidnap")
    .add("Background Check")
    .add("Civilian Arrest")
    .add("PI+Watari Unlawful Arrest")
    .add("Public Kidnap")
    .add("Unlawful Arrest");

export const loungeNumberAbilities: Set<OrganisationAbilityName> = new Set();
loungeNumberAbilities.add("Tap In");

async function kidnapCheck(orgName: OrganisationName, args: any) {
    const targetData = await Player.findOne({ userId: args.targetId });
    // if the target is dead or is not a player, they cannot be kidnapped
    if (!targetData) return failure("This person is not a player.");
    if (!targetData.flags.get("alive")) return failure("This person is dead.");
    // if the target is already locked up in some way, they cannot be kidnapped, or is protected by ipp, they cannot be kidnapped
    if (
        targetData.flags.get("custody") ||
        targetData.flags.get("incarcerated") ||
        targetData.flags.get("kidnapped") ||
        targetData.flags.get("ipp")
    )
        return failure("This person cannot be kidnapped right now.");

    if (!args.kidnapperId) return success();
    // if the kidnapper is not a player, they cannot kidnap
    const kidnapperData = await Player.findOne({
        userId: args.kidnapperId,
    });
    if (!kidnapperData) return failure("The kidnapper is not a player.");
    // if they are not part of the org, they cannot be the kidnapper.
    const orgData = await Organisation.findOne({ name: orgName });
    if (!orgData.memberIds.includes(args.kidnapperId))
        return failure("The kidnapper is not part of the organization.");
    // if they have an ability restrictor, they cannot be the kidnapper.
    if (kidnapperData.abilityRestrictors.size > 0)
        return failure("This person cannot kidnap anyone right now.");

    return success();
}

let client: Client;

const orgAbilities = {
    init(c: Client) {
        client = c;
    },

    "Background Check": async (
        orgName: OrganisationName,
        args: OrganisationAbilityArgs["Background Check"],
        checkOnly?: boolean
    ) => {
        const targetData = await Player.findOne({ userId: args.targetId });
        if (!targetData) return failure("This person is not a player.");
        if (!targetData.flags.get("alive"))
            return failure("This person is dead.");

        if (checkOnly) return success();

        const mainChannel = (await client.channels.fetch(
            config.channels[config.organisations[orgName].mainChannel]
        )) as TextChannel;
        const nameRevealMessage = await mainChannel.send(
            `The true name of **${await names.getAlias(
                args.targetId
            )}** is **${names.toReadable(targetData.trueName)}**.`
        );
        await nameRevealMessage.pin();

        return success();
    },

    "Public Kidnap": async (
        orgName: OrganisationName,
        args: OrganisationAbilityArgs["Public Kidnap"],
        checkOnly?: boolean
    ) => {
        const kidnapCheckResult = await kidnapCheck(orgName, args);
        if (!kidnapCheckResult.success) return kidnapCheckResult;

        if (checkOnly) return success();

        const orgConfig = config.organisations[orgName];
        await game.kidnap(args.targetId, orgConfig.guild, {
            kidnapperId: args.kidnapperId,
            duration: config.organisationAbilities["Public Kidnap"].duration,
        });

        return success();
    },

    "Anonymous Kidnap": async (
        orgName: OrganisationName,
        args: OrganisationAbilityArgs["Anonymous Kidnap"],
        checkOnly?: boolean
    ) => {
        const kidnapCheckResult = await kidnapCheck(orgName, args);
        if (!kidnapCheckResult.success) return kidnapCheckResult;

        if (checkOnly) return success();

        const orgConfig = config.organisations[orgName];
        await game.kidnap(args.targetId, orgConfig.guild, {
            duration: config.organisationAbilities["Anonymous Kidnap"].duration,
        });

        return success();
    },

    "2nd Kira+Kira Anonymous Kidnap": async (
        orgName: OrganisationName,
        args: OrganisationAbilityArgs["Anonymous Kidnap"],
        checkOnly?: boolean
    ) => {
        return orgAbilities["Anonymous Kidnap"](orgName, args, checkOnly);
    },

    "Unlawful Arrest": async (
        orgName: OrganisationName,
        args: OrganisationAbilityArgs["Unlawful Arrest"],
        checkOnly?: boolean
    ) => {
        const targetData = await Player.findOne({ userId: args.targetId });
        // if the target is dead or is not a player, they cannot be arrested
        if (!targetData) return failure("This person is not a player.");
        if (!targetData.flags.get("alive"))
            return failure("This person is dead.");
        // if the target is already locked up in some way, they cannot be arrested, or is protected by ipp, they cannot be arrested
        if (
            targetData.flags.get("custody") ||
            targetData.flags.get("incarcerated") ||
            targetData.flags.get("kidnapped") ||
            targetData.flags.get("ipp")
        )
            return failure("This person cannot be arrested right now.");

        if (checkOnly) return success();

        await game.incarcerate(
            args.targetId,
            config.organisationAbilities["Unlawful Arrest"].duration
        );

        return success();
    },

    "PI+Watari Unlawful Arrest": async (
        orgName: OrganisationName,
        args: OrganisationAbilityArgs["Unlawful Arrest"],
        checkOnly?: boolean
    ) => {
        return orgAbilities["Unlawful Arrest"](orgName, args, checkOnly);
    },

    // need to finish the blackout functions in the game module first
    Blackout: async (
        orgName: OrganisationName,
        args: OrganisationAbilityArgs["Blackout"],
        checkOnly?: boolean
    ) => {
        const season = await Season.findOne({});
        if (season.flags.get("blackout"))
            return failure("A blackout is already active.");

        if (checkOnly) return success();
    },
};

export default orgAbilities;
