import falseAnonymousContact from "../commands/playerCommands/falseAnonymousContact";
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
        asRole: RoleName;
    };

    falseAnonymousContact: {
        targetId: string;
        asRole: RoleName;
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

    kiraConnection: {
        channelId: string;
    };

    fakeLounge: {
        contactorId: string;
        contactedId: string;
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

    "Task Force Invite": {
        userId?: string;
        targetId: string;
        outsource?: boolean;
        trueName?: string;
    };

    "Task Force Kick": {
        userId: string;
        targetId: string;
    };
}

export interface SharedAbilityArgs {
    "Civilian Arrest": {
        targetId: string;
    };

    cancelCivArrest: {
        targetId: string;
    };

    "Tap In": {
        loungeNumber: number;
        startedBy: string;
    };
}

export type AbilityName =
    | keyof PlayerAbilityArgs
    | keyof OrganisationAbilityArgs
    | keyof SharedAbilityArgs;
