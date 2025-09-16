import type { Organisation } from "../types/configTypes";

// if there is no rank name for leader, then the org cannot have a leader.
export const organisations = {
    "Task Force": {
        guilds: ["tf"],
        abilities: [
            "Background Check",
            "Civilian Arrest",
            "Unlawful Arrest",
            "PI+Watari Unlawful Arrest",
        ],
        abilityOverrides: {},
        article: "the ",
        rankNames: {
            member: "member",
            leader: "chief",
        },
    },
    "Kira's Kingdom": {
        guilds: ["kk"],
        abilities: [
            "Blackout",
            "Public Kidnap",
            "Anonymous Kidnap",
            "Tap In",
            "2nd Kira+Kira Anonymous Kidnap",
        ],
        abilityOverrides: {},
        rankNames: {
            member: "member",
        },
    },
} as const satisfies { [orgName: string]: Organisation };

export type OrganisationName = keyof typeof organisations;
