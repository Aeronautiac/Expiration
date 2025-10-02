import type { PlayerAbility } from "../types/configTypes";

export type PlayerAbilityName =
    | "autopsy"
    | "bug"
    | "pseudocide"
    | "nameReveal"
    | "notebookReveal"
    | "underTheRadar"
    | "anonymousAnnouncement"
    | "ipp"
    | "anonymousContact"
    | "Civilian Arrest"
    | "kiraConnection"
    | "trueNameReroll";

export const playerAbilities: Record<PlayerAbilityName, PlayerAbility> = {
    autopsy: {
        charges: 1,
        cooldown: 0,
        bypasses: [],
    },
    bug: {
        charges: 1,
        cooldown: 1,
        bypasses: [],
    },
    pseudocide: {
        charges: 1,
        cooldown: 1,
        bypasses: [],
        duration: 24,
    },
    nameReveal: {
        charges: 1,
        cooldown: 0,
        bypasses: ["custody"],
    },
    notebookReveal: {
        charges: 1,
        cooldown: 0,
        bypasses: ["custody"],
    },
    underTheRadar: {
        charges: 1,
        cooldown: 999,
        bypasses: [],
    },
    anonymousAnnouncement: {
        charges: 3,
        cooldown: 0,
        bypasses: [],
    },
    ipp: {
        charges: 1,
        cooldown: 1,
        bypasses: [],
    },
    anonymousContact: {
        charges: 2,
        cooldown: 0,
        bypasses: [],
    },
    "Civilian Arrest": {
        charges: 1,
        cooldown: 1,
        bypasses: [],
    },
    trueNameReroll: {
        charges: 1,
        cooldown: 999,
        bypasses: [],
    },
    kiraConnection: {
        charges: 1,
        cooldown: 0,
        bypasses: ["custody"],
    }
};
