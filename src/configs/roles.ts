import type { Role } from "../types/configTypes";

export const roles = {
    Kira: {
        abilities: ["underTheRadar", "anonymousAnnouncement"],
        guilds: ["Kira"],
        abilityOverrides: {},
        guildChannels: {},
    },
    "Beyond Birthday": {
        abilities: ["pseudocide", "nameReveal", "notebookReveal"],
        guilds: ["Beyond Birthday"],
        abilityOverrides: {},
        guildChannels: {},
    },
    Watari: {
        abilities: ["bug", "anonymousContact"],
        guilds: ["lwatari"],
        abilityOverrides: {},
        guildChannels: {
            lwatari: ["wataridescription", "legacyledgers"],
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
        guilds: ["Private Investigator"],
        abilityOverrides: {},
        guildChannels: {},
    },
    "2nd Kira": {
        abilities: [
            "nameReveal",
            "notebookReveal",
            "underTheRadar",
            "anonymousAnnouncement",
            "kiraConnection"
        ],
        guilds: ["2nd Kira"],
        abilityOverrides: {},
        guildChannels: {},
    },
    "News Anchor": {
        abilities: ["Civilian Arrest", "cancelCivArrest"],
        guildChannels: {},
        guilds: ["News Anchor"],
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
        guilds: ["Rogue Civilian"],
        abilityOverrides: {},
    },
    "Poser": {
        abilities: ["anonymousAnnouncement", "falseAnonymousContact"],
        guildChannels: {},
        guilds: ["Poser"],
        abilityOverrides: {},
    },
    "Con Artist": {
        abilities: ["fakeLounge"],
        guildChannels: {},
        guilds: ["Con Artist"],
        abilityOverrides: {},
    },
    "Wanted Civilian": {
        abilities: ["bug", "Tap In"],
        guildChannels: {},
        guilds: ["Wanted Civilian"],
        abilityOverrides: {},
    }
} as const satisfies { [roleName: string]: Role };

export type RoleName = keyof typeof roles;
