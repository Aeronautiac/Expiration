import { Base, Guild, PermissionOverwriteOptions } from "discord.js";
import { ChannelName } from "./channels";
import { GuildName } from "./guilds";
import { OrganisationAbilityName } from "./organisationAbilities";
import { PlayerAbilityName } from "./playerAbilities";
import { PlayerStateName } from "./playerStates";
import { RoleName } from "./roles";
import { CategoryPrefixName } from "./categoryPrefixes";
import { DiscordRoleName } from "./discordRoles";
import { OrganisationName } from "./organisations";

export interface Role {
    abilities: PlayerAbilityName[]; // list of ability names that are granted to players with this role
    abilityOverrides: AbilityOverrides; // ability overrides for abilities granted by this role
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
    abilityOverrides: AbilityOverrides;
    abilities: OrganisationAbilityName[]; // list of organisation abilities that this organisation has access to
}

export type AbilityOverrides = Partial<
    Record<PlayerAbilityName | OrganisationAbilityName, Partial<BaseAbility>>
>;

export interface BaseAbility {
    cooldown: number;
    charges: number | number[];
    duration?: number; // duration in hours, if applicable
}

export interface OrganisationAbility extends BaseAbility {
    membersRequired: number;
    rolesRequired: RoleName[]; // list of role names required to use this ability
}

export interface PlayerAbility extends BaseAbility {
    bypasses: PlayerStateName[]; // list of ability restrictor states that this ability bypasses
}

export interface Config {
    dailyContactTokens: number;
    maxChannelsPerCategory: number;
    maxGroupChatSize: number;
    groupChatTokenCost: number;
    maxGroupChatsInGame: number;
    announcementDelay: number; // in seconds
    pollUpdateRate: number; // in secs
    pollYesEmoji: string;
    pollNoEmoji: string;

    loungeMemberPermissions: PermissionOverwriteOptions;
    spectatorPermissions: PermissionOverwriteOptions;
    logChannelPermissions: PermissionOverwriteOptions;
    monologueChannelPermissions: PermissionOverwriteOptions;

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
