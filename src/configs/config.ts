import type { Config } from "../types/configTypes";
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
    groupChatTokenCost: 5,
    maxGroupChatsInGame: 3,
    maxPlayersInConference: 5,
    announcementDelay: 5, // in seconds
    pollUpdateRate: 5,
    orgPollDuration: 8, // in hours
    civArrestVoteDuration: 6, // hours
    civArrestDuration: 24, // hours
    deathNoteDelayCap: 20160, // min
    pollYesEmoji: `✅`,
    pollNoEmoji: `❌`,
    groupGuilds: ["lwatari", "kk", "tf"],
    loggableChannels: ["news", "courtroom", "anonymousCourtroom", "tfLounge", "kkLounge", "lwatariLounge", "general", "media"],
    seasonDuration: 10, // days, only used for day announcement display atm
    postGameDiscussionMessage: "# --- POST GAME DISCUSSION --- #",
    postDeathDiscussionMessage: "# --- POST DEATH DISCUSSION --- #",

    loungeMemberPermissions: {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true,
        UseExternalEmojis: true,
        AddReactions: true,
    },
    spectatorPermissions: {
        ViewChannel: true,
        SendMessages: false,
        AddReactions: false,
        CreatePublicThreads: false,
        CreatePrivateThreads: false,
    },
    logChannelPermissions: {
        ViewChannel: true,
        SendMessages: false,
        CreatePublicThreads: true,
        CreatePrivateThreads: false,
        AddReactions: true,
    },
    monologueChannelPermissions: {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true,
        UseExternalEmojis: true,
        AddReactions: true,
        CreatePublicThreads: true,
        CreatePrivateThreads: true,
    },

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
