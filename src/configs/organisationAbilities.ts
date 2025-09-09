import { OrganisationAbility } from "./types";

const KIDNAP_DURATION = 24; // hours
const ARREST_DURATION = 24; // hours

export const organisationAbilities = {
    Blackout: {
        cooldown: 999,
        membersRequired: 5,
        rolesRequired: [],
        duration: 24,
    },
    "Public Kidnap": {
        cooldown: 1,
        membersRequired: 3,
        rolesRequired: [],
        duration: KIDNAP_DURATION,
    },
    "Anonymous Kidnap": {
        cooldown: 2,
        membersRequired: 5,
        rolesRequired: [],
        duration: KIDNAP_DURATION,
    },
    "2nd Kira+Kira Anonymous Kidnap": {
        cooldown: 2,
        membersRequired: 0,
        duration: KIDNAP_DURATION,
        rolesRequired: ["2nd Kira", "Kira"],
    },
    "Tap In": {
        cooldown: 1,
        membersRequired: 4,
        rolesRequired: [],
    },
    "Background Check": {
        cooldown: 1,
        membersRequired: 3,
        rolesRequired: [],
    },
    "Civilian Arrest": {
        cooldown: 1,
        membersRequired: 4,
        rolesRequired: [],
    },
    "Unlawful Arrest": {
        cooldown: 2,
        membersRequired: 5,
        rolesRequired: [],
        duration: ARREST_DURATION,
    },
    "PI+Watari Unlawful Arrest": {
        cooldown: 2,
        membersRequired: 0,
        rolesRequired: ["Private Investigator", "Watari"],
        duration: ARREST_DURATION,
    },
} as const satisfies { [abilityName: string]: OrganisationAbility };

export type OrganisationAbilityName = keyof typeof organisationAbilities;
