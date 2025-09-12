import { OrganisationAbility } from "./types";

const KIDNAP_DURATION = 24; // hours
const ARREST_DURATION = 24;
const BLACKOUT_DURATION = 24;

export const organisationAbilities = {
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
} as const satisfies { [abilityName: string]: OrganisationAbility };

export type OrganisationAbilityName = keyof typeof organisationAbilities;
