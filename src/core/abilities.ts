import { Client } from "discord.js";

import Player, { IPlayer } from "../models/player";
import Ability, { IAbility } from "../models/ability";
import Season, { ISeason } from "../models/season";
import { config } from "../configs/config";
import names from "./names";
import { Result, failure, success } from "../types/Result";
import playerAbilities from "./playerAbilities";
import organisationAbilities from "./organisationAbilities";
import Organisation, { IOrganisation } from "../models/organisation";
import {
  BaseAbility,
  OrganisationAbility,
  PlayerAbility,
} from "../types/configTypes";
import { PlayerStateName } from "../configs/playerStates";
import {
  AbilityArgsMap,
  AbilityName,
  OrganisationAbilityArgs,
  PlayerAbilityArgs,
} from "../configs/abilityArgs";
import { OrganisationAbilityName } from "../configs/organisationAbilities";
import { PlayerAbilityName } from "../configs/playerAbilities";
import { OrganisationName, organisations } from "../configs/organisations";
import orgs from "./orgs";

let client: Client;

async function applyUsageConsequences(
  season: ISeason,
  abilityData: IAbility,
  abilityConfig: BaseAbility,
  subtractCharges: number
) {
  // charges
  // find default ability number based on the current day
  function getChargesBasedOnDay(chargeArray: number[]): number {
    // array with index 0 corresponding to season day 1 and onward. the value in this index is the number of charges available on that day and beyond.
    // if there is no value at the index of the current day, then the value is the last index in the array.
    const currentDay = season.day - 1;
    return chargeArray[currentDay] ?? chargeArray[chargeArray.length - 1];
  }

  const defaultCharges = Array.isArray(abilityConfig.charges)
    ? getChargesBasedOnDay(abilityConfig.charges)
    : abilityConfig.charges;

  // if their charges for this ability have not been initialized today, initialize them.
  // if they have, then subtract 1 and clamp to 0.
  if (abilityData.charges === null || abilityData.charges === undefined) {
    abilityData.charges = Math.max(0, defaultCharges - subtractCharges);
  } else {
    abilityData.charges = Math.max(
      0,
      abilityData.charges - subtractCharges
    );
  }

  // set the cooldown to whatever their cooldown for this ability should be at this moment
  // later need to implement overrides
  abilityData.queuedCooldown = abilityConfig.cooldown;
  await abilityData.save();
}

const abilities = {
  init(c: Client) {
    client = c;
  },

  async useAbility<K extends AbilityName>(
    owner: string,
    abilityName: K,
    args: AbilityArgsMap[K],
    checkOnly?: boolean,
    excludeChecks: (
      | "possession"
      | "role"
      | "restrictors"
      | "members"
      | "charges"
      | "cooldown"
    )[] = []
  ): Promise<Result> {
    // if posessions checks are excluded, then by extension, so are charge and cooldown checks.
    if (excludeChecks.includes("possession")) {
      excludeChecks.push("charges");
      excludeChecks.push("cooldown");
    }

    // abilities can only be used when a season is active
    const season = await Season.findOne({});
    if (!season || !season.flags.get("active"))
      return failure("The season is not yet active.");

    // abilities can only be used by a player/organisation that possesses the ability
    const abilitiesData = await Ability.find({
      owner,
      ability: abilityName,
    });

    if (abilitiesData.length === 0 && !excludeChecks.includes("possession"))
      return failure("You do not possess this ability.");

    // try to find an ability with available charges and no cd
    let abilityData: IAbility;
    for (const adata of abilitiesData) {
      if ((adata.charges === undefined || adata.charges > 0) && adata.cooldown === 0) {
        abilityData = adata;
        break;
      }
    }
    if (!abilityData)
      abilityData = abilitiesData[0];

    // no player data -- no ability usage (if the user is a player)
    let userData: IPlayer;
    if (abilityData.type === "player") {
      userData = await Player.findOne({ userId: owner });
      if (!userData)
        return failure(
          "You cannot use abilities. You are not yet registered as a player."
        );
    }

    // no organisation data -- no ability usage (if org)
    let organisationData: IOrganisation;
    if (abilityData.type === "organisation") {
      organisationData = await Organisation.findOne({ name: owner });
      if (!organisationData)
        return failure(
          "You cannot use this ability. This organisation has no data."
        );
    }

    // the ability does not exist
    const orgBase: OrganisationAbility =
      config.organisationAbilities[
      abilityName as OrganisationAbilityName
      ];
    const playerBase: PlayerAbility =
      config.playerAbilities[abilityName as PlayerAbilityName];
    if (!orgBase && !playerBase) return failure("Ability does not exist.");

    // if there are overrides, apply them here
    const orgOverrides =
      config.organisations[owner as OrganisationName]?.abilityOverrides[
      abilityName as OrganisationAbilityName
      ];
    const orgAbilityConfig = orgBase
      ? Object.assign({}, orgBase, orgOverrides)
      : null;
    const roleOverrides =
      config.roles[userData?.role]?.abilityOverrides[
      abilityName as PlayerAbilityName
      ];
    const playerAbilityConfig = playerBase
      ? Object.assign({}, playerBase, roleOverrides)
      : null;

    // the ability exists, but the function is not implemented
    const callbackSource =
      abilityData.type === "player"
        ? playerAbilities
        : organisationAbilities;
    const abilityCallback = callbackSource[abilityName as string];
    if (!abilityCallback)
      return failure(`${abilityName} is not yet implemented.`);

    // if the ability requires the player to have a certain role, but the player does not have that role, then they cannot use the ability
    if (
      abilityData.type === "player" &&
      abilityData.roleRestrictions.length > 0 &&
      !abilityData.roleRestrictions.includes(userData.role) &&
      !excludeChecks.includes("role")
    ) {
      return failure(
        `You cannot use this ability because it is restricted to the ${abilityData.roleRestrictions[0]} role.`
      );
    }

    // if the org does not have enough members to use the ability, or does not have the roles required, then they cannot use the ability
    if (abilityData.type === "organisation") {
      const votingMemberIds = await orgs.getVotingMembers(
        owner as OrganisationName
      );
      const memberCount = votingMemberIds.length;
      const rolesInOrgPromises = votingMemberIds.map(async (memberId) => {
        const data = await Player.findOne({ userId: memberId });
        if (data) {
          return data.role;
        }
      });
      const rolesInOrg = (await Promise.all(rolesInOrgPromises)).filter(
        (x) => x !== undefined
      );

      if (
        memberCount < orgAbilityConfig.membersRequired &&
        !excludeChecks.includes("members")
      )
        return failure(
          `You do not have enough members to use this ability.`
        );

      for (const role of orgAbilityConfig.rolesRequired)
        if (
          !rolesInOrg.includes(role) &&
          !excludeChecks.includes("role")
        )
          return failure(
            `This organisation does not have the roles required to use this ability.`
          );
    }

    // do they have any ability restrictors that are not bypassed by the ability's config? (for players)
    if (abilityData.type === "player") {
      const activeRestrictors = Array.from(userData.abilityRestrictors)
        .filter(
          ([restrictor, value]) =>
            value &&
            !playerAbilityConfig.bypasses.includes(
              restrictor as PlayerStateName
            )
        )
        .map(([restrictor]) => restrictor);
      if (
        activeRestrictors.length > 0 &&
        !excludeChecks.includes("restrictors")
      )
        return failure(
          `Cannot use ability because of restrictors: ${activeRestrictors.toString()}`
        );
    }

    if (abilityData.charges !== undefined && abilityData.charges !== null)
      if (abilityData.charges === 0 && !excludeChecks.includes("charges"))
        return failure(`You have run out of charges for this ability.`);

    const cd = abilityData.cooldown;
    if (cd > 0 && !excludeChecks.includes("cooldown"))
      return failure(`This ability is on cooldown for ${cd} day(s).`);

    // if we're only checking if the ability can be used, this will be the final bit
    // try to use the ability. if it rejects, then reject with the same reasoning.
    // if this check is passed, then the ability was/can be used successfully
    const result = await abilityCallback(abilityData, owner, args, checkOnly);
    if (!result.success) return result;

    // end before the ability use logic is executed if we're only checking if we can use the ability
    if (checkOnly) return success();

    // log ability usage
    const timeString = `<t:${Math.floor(Date.now() / 1000)}:F>`;
    const userAlias =
      abilityData.type === "player"
        ? await names.getAlias(owner)
        : organisationData.name;
    const logMessage = `**${userAlias}** used **${abilityName}** at ${timeString} with args: ${JSON.stringify(
      args
    )}`;
    const hostLogs = await client.channels.fetch(config.channels.hostLogs);
    if (hostLogs && hostLogs.isSendable()) await hostLogs.send(logMessage);

    const abilityConfig: BaseAbility =
      orgAbilityConfig ?? playerAbilityConfig;

    // main ability usage
    await applyUsageConsequences(season, abilityData, abilityConfig, 1);

    // handle linked abilities
    if (abilityConfig.linkedAbilities) {
      for (const [name, info] of Object.entries(
        abilityConfig.linkedAbilities
      )) {
        const linkedAbilityConfig: BaseAbility =
          config.organisationAbilities[name] ??
          config.playerAbilities[name];
        const linkedAbilityData = await Ability.findOne({
          owner,
          ability: name,
        });
        if (linkedAbilityData)
          await applyUsageConsequences(
            season,
            linkedAbilityData,
            linkedAbilityConfig,
            info.useCharges
          );
      }
    }

    return success(
      `Successfully used ${abilityName}. Charges remaining: ${abilityData.charges}`
    );
  },

  // just an alias
  async canUseAbility<K extends AbilityName>(
    owner: string,
    abilityName: K,
    args: AbilityArgsMap[K]
  ): Promise<Result> {
    return abilities.useAbility(owner, abilityName, args, true);
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
        owner: userId,
        ability: abilityName,
      });
      if (existingAbility) {
        existingAbility.roleRestrictions = [playerData.role];
        continue;
      }
      // give the ability
      await Ability.create({
        type: "player",
        owner: userId,
        ability: abilityName,
        identifier: playerData.role,
        roleRestrictions: [playerData.role],
      });
    }
  },

  async initializeOrganisationAbilities(name: OrganisationName) {
    const orgData = await Organisation.findOne({ name });
    if (!orgData) return;

    const abilitiesToGive = organisations[name].abilities;
    for (const abilityName of abilitiesToGive) {
      // if the ability does not exist, skip it
      const abilityConfig = config.organisationAbilities[abilityName];
      if (!abilityConfig) continue;
      // dont give the ability if they already have it
      const existingAbility = await Ability.findOne({
        owner: name,
        ability: abilityName,
      });
      if (existingAbility) continue;
      // give the ability
      await Ability.create({
        owner: name,
        type: "organisation",
        ability: abilityName,
        roleRestrictions:
          config.organisationAbilities[abilityName].rolesRequired,
      });
    }
  },

  // decrements any existing cooldowns and applies end of day cooldowns
  async progressCooldowns() {
    // decrement any existing cds
    await Ability.updateMany(
      { cooldown: { $gt: 0 } },
      { $inc: { cooldown: -1 } }
    );
    // apply end of day cds
    const queuedCdAbilities = await Ability.find({
      queuedCooldown: { $exists: true },
    });
    const promises = queuedCdAbilities.map(async (ability) => {
      await Ability.updateOne(
        { _id: ability._id },
        {
          cooldown: ability.queuedCooldown,
          $unset: {
            queuedCooldown: "",
            charges: "",
          },
        }
      );
    });
    await Promise.all(promises);
  },
};

export default abilities;
