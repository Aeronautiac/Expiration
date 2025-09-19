import { Client } from "discord.js";
import { OrganisationAbilityName } from "../configs/organisationAbilities";
import { OrganisationName } from "../configs/organisations";
import { OrganisationAbilityArgs } from "../configs/abilityArgs";

export const kidnapperAbilities: Set<OrganisationAbilityName> = new Set();
kidnapperAbilities
    .add("Public Kidnap");

export const targetAbilities: Set<OrganisationAbilityName> = new Set();
targetAbilities
    .add("2nd Kira+Kira Anonymous Kidnap")
    .add("Anonymous Kidnap")
    .add("Background Check")
    .add("Civilian Arrest")
    .add("PI+Watari Unlawful Arrest")
    .add("Public Kidnap")
    .add("Unlawful Arrest");

export const loungeNumberAbilities: Set<OrganisationAbilityName> = new Set();
loungeNumberAbilities
    .add("Tap In");

let client: Client;

const orgAbilities = {

    init(c: Client) {
        client = c;
    },

    "Background Check": async(orgName: OrganisationName, args: OrganisationAbilityArgs["Background Check"], checkOnly?: boolean) => {

    },

    "Public Kidnap": async(orgName: OrganisationName, args: OrganisationAbilityArgs["Public Kidnap"], checkOnly?: boolean) => {

    },

    "Blackout": async(orgName: OrganisationName, args: OrganisationAbilityArgs["Blackout"], checkOnly?: boolean) => {

    },

    "Anonymous Kidnap": async(orgName: OrganisationName, args: OrganisationAbilityArgs["Anonymous Kidnap"], checkOnly?: boolean) => {

    },

    "2nd Kira+Kira Anonymous Kidnap": async(orgName: OrganisationName, args: OrganisationAbilityArgs["Anonymous Kidnap"], checkOnly?: boolean) => {
        return orgAbilities["Anonymous Kidnap"](orgName, args, checkOnly);
    },
}

export default orgAbilities;