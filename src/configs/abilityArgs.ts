import { Result } from "../types/Result";
import { RoleName } from "./roles";

export interface PlayerAbilityArgs {
    pseudocide: {
        targetId: string;
        role: RoleName;
        trueName: string;
        hasNotebook?: boolean;
        hasBugAbility?: boolean;
        message?: string;
        affiliationsString?: string;
    };

    ipp: {
        targetId: string;
    };
}

export interface OrganisationAbilityArgs {}

export type AbilityName =
    | keyof PlayerAbilityArgs
    | keyof OrganisationAbilityArgs;
