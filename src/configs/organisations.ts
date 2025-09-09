import type { Organisation } from "./types";

export const organisations = {
    "Task Force": {
        guilds: ["tf"],
        abilities: ["Background Check", "Civilian Arrest", "Unlawful Arrest"],
    },
    "Kira's Kingdom": {
        guilds: ["kk"],
        abilities: ["Blackout", "Public Kidnap", "Anonymous Kidnap", "Tap In"],
    },
} as const satisfies { [orgName: string]: Organisation };

export type OrganisationName = keyof typeof organisations;