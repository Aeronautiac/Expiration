import { OrganisationAbility } from "../types/configTypes";

const KIDNAP_DURATION = 24; // hours
const ARREST_DURATION = 24;
const BLACKOUT_DURATION = 24;

export type OrganisationAbilityName =
    | "Blackout"
    | "Public Kidnap"
    | "Anonymous Kidnap"
    | "Kira's Kingdom Invite"
    | "Kira's Kingdom Kick"
    | "2nd Kira+Kira Anonymous Kidnap"
    | "Tap In"
    | "Background Check"
    | "Civilian Arrest"
    | "Unlawful Arrest"
    | "Shinigami Sacrifice"
    | "Task Force Invite"
    | "Task Force Kick"
    | "PI+Watari Unlawful Arrest";

export const organisationAbilities: Record<
    OrganisationAbilityName,
    OrganisationAbility
> = {
    Blackout: {
        charges: 1,
        cooldown: 999,
        membersRequired: 5,
        rolesRequired: [],
        duration: BLACKOUT_DURATION,
    },
    "Public Kidnap": {
        charges: 1,
        cooldown: 0,
        membersRequired: 3,
        rolesRequired: [],
        duration: KIDNAP_DURATION,
    },
    "Anonymous Kidnap": {
        charges: 1,
        cooldown: 1,
        membersRequired: 5,
        rolesRequired: [],
        duration: KIDNAP_DURATION,
    },
    "Task Force Invite": {
        charges: 2,
        cooldown: 0,
        membersRequired: 0,
        rolesRequired: [],
    },
    "Task Force Kick": {
        charges: 1,
        cooldown: 0,
        membersRequired: 0,
        rolesRequired: [],
    },
    "Kira's Kingdom Invite": {
        charges: 2,
        cooldown: 0,
        membersRequired: 0,
        rolesRequired: [],
    },
    "Kira's Kingdom Kick": {
        charges: 999,
        cooldown: 0,
        membersRequired: 0,
        rolesRequired: [],
    },
    "2nd Kira+Kira Anonymous Kidnap": {
        charges: 1,
        cooldown: 1,
        membersRequired: 0,
        duration: KIDNAP_DURATION,
        rolesRequired: ["2nd Kira", "Kira"],
    },
    "Tap In": {
        charges: 1,
        cooldown: 0,
        membersRequired: 4,
        rolesRequired: [],
    },
    "Background Check": {
        charges: 1,
        cooldown: 0,
        membersRequired: 3,
        rolesRequired: [],
    },
    "Civilian Arrest": {
        charges: 1,
        cooldown: 0,
        membersRequired: 4,
        rolesRequired: [],
    },
    "Unlawful Arrest": {
        charges: 1,
        cooldown: 1,
        membersRequired: 5,
        rolesRequired: [],
        duration: ARREST_DURATION,
    },
    "PI+Watari Unlawful Arrest": {
        charges: 1,
        cooldown: 1,
        membersRequired: 0,
        rolesRequired: ["Private Investigator", "Watari"],
        duration: ARREST_DURATION,
    },
    "Shinigami Sacrifice": {
        charges: 1,
        cooldown: 0,
        membersRequired: 0,
        rolesRequired: [],
    },
};
