import { Client } from "discord.js";

import Player from "../models/playerts";
import Ability from "../models/ability";
import Season from "../models/season";
import { config } from "../configs/config";
import names from "./names";
import { Result, failure, success } from "../types/Result";
import { PlayerStateName } from "../configs/playerStates";

let client: Client;

interface AbilityArgs {
    pseudocide: {
        targetId: string;
        role: string;
        trueName: string;
        hasNotebook?: boolean;
        hasBugAbility?: boolean;
        message?: string;
        affiliationsString?: string;
    };

    ipp: {
        targetId: string;
    };
}

const abilities: Partial<{
    [K in keyof AbilityArgs]: (
        userId: string,
        args: AbilityArgs[K]
    ) => Promise<Result>;
}> = {};

const module = {
    init(c: Client) {
        client = c;
    },

    // NEED TO IMPLEMENT ABILITY OVERRIDES SYSTEM
    async useAbility<K extends keyof AbilityArgs>(
        userId: string,
        abilityName: K,
        args: AbilityArgs[K]
    ) {
        // abilities can only be used when a season is active
        const season = await Season.findOne({});
        if (!season || !season.active)
            return failure("The season is not yet active.");

        // the ability does not exist
        const abilityConfig = config.playerAbilities[abilityName];
        if (!abilityConfig) return failure("Ability does not exist.");

        // the ability exists, but the function is not implemented
        const abilityCallback = abilities[abilityName];
        if (!abilityCallback)
            return failure(`${abilityName} is not yet implemented.`);

        // no player data -- no ability usage
        const userData = await Player.findOne({ userId: userId });
        if (!userData)
            return failure(
                "You cannot use abilities. You are not yet registered as a player."
            );

        // abilities can only be used by a player if the player possesses the ability
        const abilityData = await Ability.findOne({
            ownerId: userId,
            ability: abilityName,
        });
        if (!abilityData) return failure("You do not possess this ability.");

        // if the ability has a role restriction, but the player is not that role, then they cannot use the ability
        if (
            abilityData.roleRestriction &&
            abilityData.roleRestriction !== userData.role
        )
            return failure(
                `You cannot use this ability because it is restricted to the ${abilityData.roleRestriction} role.`
            );

        // do they have any ability restrictors that are not bypassed by the ability's config?
        const activeRestrictors = Array.from(userData.abilityRestrictors)
            .filter(
                ([restrictor, value]) =>
                    value && !((abilityConfig.bypasses as string[]).includes(restrictor))
            )
            .map(([restrictor]) => restrictor);
        if (activeRestrictors.length > 0)
            return failure(
                `Cannot use ability because of restrictors: ${activeRestrictors.toString()}`
            );

        if (abilityData.charges !== undefined && abilityData.charges !== null)
            if (abilityData.charges === 0)
                return failure(`You have run out of charges for this ability.`);

        const cd = abilityData.cooldown;
        if (cd > 0)
            return failure(`This ability is on cooldown for ${cd} day(s).`);

        // try to use the ability. if it rejects, then reject with the same reasoning.
        // if this check is passed, then the ability was used successfully
        const result = await abilityCallback(userId, args);
        if (!result.success) return result;

        // log ability usage
        const timeString = `<t:${Math.floor(Date.now() / 1000)}:F>`;
        const userAlias = await names.getAlias(userId);
        const logMessage = `**${userAlias}** used **${abilityName}** at ${timeString} with args: ${JSON.stringify(
            args
        )}`;
        const hostLogs = await client.channels.fetch(config.channels.hostLogs);
        if (hostLogs && hostLogs.isSendable()) await hostLogs.send(logMessage);

        // charges
        // find default ability number based on the current day
        function getChargesBasedOnDay(chargeArray: number[]): number {
            // array with index 0 corresponding to season day 1 and onward. the value in this index is the number of charges available on that day and beyond.
            // if there is no value at the index of the current day, then the valueF is the last index in the array.
            const currentDay = season.day - 1;
            return (
                chargeArray[currentDay] ?? chargeArray[chargeArray.length - 1]
            );
        }

        const defaultCharges = Array.isArray(abilityConfig.charges)
            ? getChargesBasedOnDay(abilityConfig.charges)
            : abilityConfig.charges;

        // if their charges for this ability have not been initialized today, initialize them.
        // if they have, then subtract 1 and clamp to 0.
        if (abilityData.charges === null || abilityData.charges === undefined) {
            abilityData.charges = defaultCharges - 1;
        } else {
            abilityData.charges = Math.max(0, abilityData.charges - 1);
        }

        abilityData.usedToday = true;
        await abilityData.save();

        return success(
            `Successfully used ${abilityName}. Charges remaining: ${abilityData.charges}`
        );
    },

    async giveRoleAbilities(userId: string): Promise<void> {
        const playerData = await Player.findOne({ userId });

        const roleData = config.roles[playerData.role];
        if (!roleData) return;

        const abilitiesToGive = roleData.abilities;
        for (const abilityName of abilitiesToGive) {
            // if the ability does not exist, skip it
            const abilityConfig = config.playerAbilities[abilityName];
            if (!abilityConfig) continue;
            // dont give the ability if they already have it
            const existingAbility = await Ability.findOne({
                ownerId: userId,
                ability: abilityName,
            });
            if (existingAbility) continue;
            // give the ability
            await Ability.create({
                ownerId: userId,
                ability: abilityName,
                roleRestriction: playerData.role,
            });
        }
    },
};

abilities.pseudocide = async function (userId, args) {
    const targetData = await Player.findOne({ userId: args.targetId });
    if (!targetData) return failure("This user is not registered as a player.");
    if (!targetData.flags.get("alive")) return failure("This user is dead.");
    if (targetData.flags.get("ipp")) return failure("This user is under IPP.");

    let affiliations = [];
    if (args.affiliationsString)
        affiliations = args.affiliationsString.split(", ");

    const target = await client.users.fetch(args.targetId);
    await target
        .send(
            "You have been pseudocided. Do not ask any players for information in the shinigami realm. If you do so, you will be punished."
        )
        .catch(() => {
            console.warn(
                `Could not notify user ${args.targetId} of pseudocide.`
            );
        });

    // continue with pseudocide specific logic
    // await killUser(interaction.client, target, null, true);
    // await deathMessage(
    //     interaction.client,
    //     target,
    //     message,
    //     trueName,
    //     role,
    //     hasNotebook,
    //     affiliations,
    //     hasBugAbility
    // );

    // await createDelayedAction(
    //     interaction.client,
    //     "onPseudocideRevival",
    //     hrsToMs(24),
    //     [target.id, targetData.role]
    // );

    return success();
};

abilities.ipp = async function (userId, args) {
    const targetData = await Player.findOne({ userId: args.targetId });
    if (!targetData) return failure("This user has no data.");
    if (!targetData.flags.get("alive")) return failure("This user is dead.");
    if (targetData.flags.get("ipp"))
        return failure("This user is already under IPP.");

    const mainGuild = await client.guilds.fetch(config.guilds.main);
    const targetMember = await mainGuild.members
        .fetch(args.targetId)
        .catch(() => null);
    if (!targetMember)
        return failure("Target is not in the main Discord server.");

    targetData.flags.set("ipp", true);
    await targetData.save();

    names.setNick(args.targetId, `${targetMember.displayName} (IPP)`);

    return success();
};

export default module;
