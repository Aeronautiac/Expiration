import type { Organisation } from "./types";

export const organisations = {
    "Task Force": {
        guilds: ["tf"],
        abilities: ["Background Check", "Civilian Arrest", "Unlawful Arrest", "PI+Watari Unlawful Arrest"],
    },
    "Kira's Kingdom": {
        guilds: ["kk"],
        abilities: ["Blackout", "Public Kidnap", "Anonymous Kidnap", "Tap In", "2nd Kira+Kira Anonymous Kidnap"],
    },
} as const satisfies { [orgName: string]: Organisation };

export type OrganisationName = keyof typeof organisations;