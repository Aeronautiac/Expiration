import { OrgMember } from "../types/OrgMember";
import { RoleName } from "./roles";

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
}

export interface OrganisationAbilityArgs {}

export type AbilityName =
    | keyof PlayerAbilityArgs
    | keyof OrganisationAbilityArgs;
