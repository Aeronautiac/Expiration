import { OrgMember } from "../types/OrgMember";
import { RoleName } from "./roles";

export type AbilityArgsMap = PlayerAbilityArgs &
    OrganisationAbilityArgs &
    SharedAbilityArgs;

export interface PlayerAbilityArgs {
    pseudocide: {
        targetId: string;
        role: RoleName;
        trueName: string;
        memberObjects: OrgMember[];
        hasNotebook?: boolean;
        hasBugAbility?: boolean;
        message?: string;
    };

    ipp: {
        targetId: string;
    };

    underTheRadar: {};

    bug: {
        targetId: string;
    };

    anonymousAnnouncement: {
        message: string;
    };

    anonymousContact: {
        targetId: string;
    };

    autopsy: {
        targetId: string;
    };

    nameReveal: {
        targetId: string;
    };

    notebookReveal: {
        targetId: string;
    };

    trueNameReroll: {
        targetId: string;
    };
}

export interface OrganisationAbilityArgs {
    Blackout: {};

    "Public Kidnap": {
        kidnapperId: string;
        targetId: string;
    };

    "Anonymous Kidnap": {
        targetId: string;
    };

    "Kira's Kingdom Invite": {
        targetId: string;
    };
    "Kira's Kingdom Kick": {
        targetId: string;
    };

    "Tap In": {
        loungeNumber: number;
    };

    "Background Check": {
        targetId: string;
    };

    "Unlawful Arrest": {
        targetId: string;
    };

    "Shinigami Sacrifice": {
        targetId: string;
        memberId: string;
    };
}

export interface SharedAbilityArgs {
    "Civilian Arrest": {
        targetId: string;
    };
}

export type AbilityName =
    | keyof PlayerAbilityArgs
    | keyof OrganisationAbilityArgs
    | keyof SharedAbilityArgs;
