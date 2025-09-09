import type { Config } from "./types";
import { categoryPrefixes } from "./categoryPrefixes";
import { guilds } from "./guilds";
import { channels } from "./channels";
import { discordRoles } from "./discordRoles";
import { roles } from "./roles";
import { playerAbilities } from "./playerAbilities";
import { playerStates } from "./playerStates";
import { organisations } from "./organisations";
import { organisationAbilities } from "./organisationAbilities";

export const config = {
    dailyContactTokens: 5,
    maxChannelsPerCategory: 50,
    maxGroupChatSize: 5,
    maxGroupChatsInGame: 3,

    categoryPrefixes: categoryPrefixes,
    guilds: guilds,
    channels: channels,
    discordRoles: discordRoles,
    roles: roles,
    playerAbilities: playerAbilities,
    playerStates: playerStates,
    organisations: organisations,
    organisationAbilities: organisationAbilities,
} as const satisfies Config;
