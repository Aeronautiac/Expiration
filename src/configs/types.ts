import { Guild, PermissionOverwriteOptions } from "discord.js";
import { ChannelName } from "./channels";
import { GuildName } from "./guilds";
import { OrganisationAbilityName } from "./organisationAbilities";
import { PlayerAbilityName } from "./playerAbilities";
import { PlayerStateName } from "./playerStates";
import { RoleName } from "./roles";
import { CategoryPrefixName } from "./categoryPrefixes";
import { DiscordRoleName } from "./discordRoles";
import { OrganisationName } from "./organisations";

export interface PlayerAbility {
    charges: number | number[];
    cooldown: number;
    bypasses: PlayerStateName[]; // list of ability restrictor states that this ability bypasses
    duration?: number; // duration in hours, if applicable
}

export interface Role {
    abilities: PlayerAbilityName[]; // list of ability names that are granted to players with this role
    abilityOverrides: Partial<Record<PlayerAbilityName, Partial<PlayerAbility>>>; // ability overrides for abilities granted by this role
    guilds: GuildName[]; // list of guild names that players with this role should have access to
    guildChannels: Partial<Record<GuildName, ChannelName[]>>; // list of channel names that players with this role should have access to in each guild
}

export interface PlayerState {
    restrictsAbilities: boolean;
    restrictsNotebookWriting: boolean;
    restrictsContacts: boolean;
    restrictsNotebookPassing: boolean;
}

export interface Organisation {
    guilds: GuildName[]; // list of guild names that members of this organisation should have access to
    abilities: OrganisationAbilityName[]; // list of organisation abilities that this organisation has access to
}

export interface OrganisationAbility {
    cooldown: number;
    membersRequired: number;
    rolesRequired: RoleName[]; // list of role names required to use this ability
    duration?: number;
}

export interface Config {
    dailyContactTokens: number;
    maxChannelsPerCategory: number;
    maxGroupChatSize: number;
    maxGroupChatsInGame: number;

    loungeMemberPermissions: PermissionOverwriteOptions;
    spectatorPermissions: PermissionOverwriteOptions;
    logChannelPermissions: PermissionOverwriteOptions;

    categoryPrefixes: Record<CategoryPrefixName, string>;
    guilds: Record<GuildName, string>;
    channels: Record<ChannelName, string>;
    discordRoles: Record<DiscordRoleName, string>;

    roles: Record<RoleName, Role>;
    playerAbilities: Record<PlayerAbilityName, PlayerAbility>;
    playerStates: Record<PlayerStateName, PlayerState>;
    organisations: Record<OrganisationName, Organisation>;
    organisationAbilities: Record<OrganisationAbilityName, OrganisationAbility>;
}