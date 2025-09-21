import type { Role } from "../types/configTypes";

export const roles = {
    Kira: {
        abilities: ["underTheRadar", "anonymousAnnouncement"],
        guilds: ["kira"],
        abilityOverrides: {},
        guildChannels: {},
    },
    "Beyond Birthday": {
        abilities: ["pseudocide", "nameReveal", "notebookReveal"],
        guilds: ["bb"],
        abilityOverrides: {},
        guildChannels: {},
    },
    Watari: {
        abilities: ["bug", "anonymousContact"],
        guilds: ["lwatari"],
        abilityOverrides: {},
        guildChannels: {
            lwatari: ["wataridescription"],
        },
    },
    L: {
        abilities: ["anonymousAnnouncement"],
        guilds: ["lwatari"],
        abilityOverrides: {},
        guildChannels: {
            lwatari: ["ldescription", "legacyledgers"],
        },
    },
    "Private Investigator": {
        abilities: ["autopsy", "ipp", "anonymousContact", "trueNameReroll"],
        guilds: ["pi"],
        abilityOverrides: {},
        guildChannels: {},
    },
    "2nd Kira": {
        abilities: [
            "nameReveal",
            "notebookReveal",
            "underTheRadar",
            "anonymousAnnouncement",
        ],
        guilds: ["2kira"],
        abilityOverrides: {
            nameReveal: {
                charges: [1, 2],
            },
        },
        guildChannels: {},
    },
    "News Anchor": {
        abilities: ["Civilian Arrest"],
        guildChannels: {},
        guilds: ["newsAnchor"],
        abilityOverrides: {},
    },
    Civilian: {
        abilities: [],
        guildChannels: {},
        guilds: [],
        abilityOverrides: {},
    },
    "Rogue Civilian": {
        abilities: [],
        guildChannels: {},
        guilds: ["rogueCivilian"],
        abilityOverrides: {},
    },
} as const satisfies { [roleName: string]: Role };

export type RoleName = keyof typeof roles;
