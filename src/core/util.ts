import {
    Channel,
    ChannelType,
    Client,
    NewsChannel,
    PermissionOverwriteOptions,
    PermissionOverwrites,
    PermissionsBitField,
    StageChannel,
    TextChannel,
    VoiceChannel,
} from "discord.js";
import Season from "../models/season";
import { config } from "../configs/config";
import { PlayerStateName } from "../configs/playerStates";
import Player from "../models/player";
import contacting from "./contacting";
import { DiscordRoleName } from "../configs/discordRoles";
import { RoleName } from "../configs/roles";
import { failure, Result, success } from "../types/Result";
import { fail } from "agenda/dist/job/fail";

let client: Client;

export type ChannelPerms = {
    ids: string[];
    perms: PermissionOverwriteOptions;
};

const util = {
    init: function (newClient: Client) {
        client = newClient;
    },

    async sleep(sec: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, util.secToMs(sec)));
    },

    async createTemporaryChannel(
        guildId: string,
        name: string,
        categoryPrefix: string,
        perms: ChannelPerms[] = []
    ): Promise<Channel> {
        const season = await Season.findOne({});
        if (!season) throw new Error("No season exists.");

        const guild = await client.guilds.fetch(guildId);
        const newChannel = await guild.channels.create({ name });

        const allChannels = await guild.channels.fetch();

        // get all channel categories with category prefix and sort them based on their number
        const categories = allChannels
            .filter(
                (channel) =>
                    channel.type === ChannelType.GuildCategory &&
                    channel.name.startsWith(categoryPrefix)
            )
            .sort((a, b) => {
                const numA = parseInt(a.name.replace(categoryPrefix, ""));
                const numB = parseInt(b.name.replace(categoryPrefix, ""));
                return numA - numB;
            });

        // find the least numbered category that has an available space for a new channel
        let chosenCategory = null;
        let categoryNumber = 1;
        for (const category of categories.values()) {
            const children = allChannels.filter(
                (c) => c.parentId === category.id
            );

            if (children.size < config.maxChannelsPerCategory) {
                chosenCategory = category;
                break;
            }

            categoryNumber++;
        }

        // if there is no category available, create a new one
        if (!chosenCategory) {
            const newCategory = await guild.channels.create({
                name: `${categoryPrefix}${categoryNumber}`,
                type: ChannelType.GuildCategory,
            });

            chosenCategory = newCategory;
        }

        // add perms
        await util.addPermissionsToChannel(newChannel.id, perms);

        season.temporaryChannels.push(newChannel.id);
        await season.save();

        return newChannel;
    },

    async addPermissionsToChannel(
        channelId: string,
        permissions: ChannelPerms[]
    ) {
        const channel = await client.channels.fetch(channelId);
        if (
            !channel ||
            !(
                channel instanceof TextChannel ||
                channel instanceof NewsChannel ||
                channel instanceof VoiceChannel ||
                channel instanceof StageChannel
            )
        )
            throw new Error(
                "Channel is not a text, news, voice, or stage channel."
            );

        const overwrites = channel.permissionOverwrites;
        const promises = permissions.map(async (entry) => {
            for (const id of entry.ids) {
                await overwrites.create(id, entry.perms);
            }
        });
        await Promise.allSettled(promises);
    },

    async deletePermissionsToChannel(channelId: string, ids: string[]) {
        const channel = await client.channels.fetch(channelId);
        if (
            !channel ||
            !(
                channel instanceof TextChannel ||
                channel instanceof NewsChannel ||
                channel instanceof VoiceChannel ||
                channel instanceof StageChannel
            )
        )
            throw new Error(
                "Channel is not a text, news, voice, or stage channel."
            );

        const overwrites = channel.permissionOverwrites;
        const promises = ids.map(async (id) => {
            await overwrites.delete(id);
        });
        await Promise.all(promises);
    },

    async addState(userId: string, state: PlayerStateName) {
        const playerData = await Player.findOne({ userId });
        if (!playerData) throw new Error("Player does not exist.");

        // set the flag
        playerData.flags.set(state, true);

        // apply restrictors for the flag/state if applicable
        const stateConfig = config.playerStates[state];
        if (stateConfig) {
            if (stateConfig.restrictsAbilities)
                playerData.abilityRestrictors.set(state, true);
            if (stateConfig.restrictsContacts)
                await contacting.addLoungeHider(userId, state);
            if (stateConfig.restrictsNotebookWriting)
                playerData.notebookWriteRestrictors.set(state, true);
            if (stateConfig.restrictsNotebookPassing)
                playerData.notebookPassRestrictors.set(state, true);
        }

        await playerData.save();
    },

    async removeState(userId: string, state: PlayerStateName) {
        const playerData = await Player.findOne({ userId });
        if (!playerData) throw new Error("Player does not exist.");

        // remove the flag
        playerData.flags.set(state, false);

        // remove restrictors for the flag/state if applicable
        const stateConfig = config.playerStates[state];
        if (stateConfig) {
            if (stateConfig.restrictsAbilities)
                playerData.abilityRestrictors.delete(state);
            if (stateConfig.restrictsContacts)
                await contacting.removeLoungeHider(userId, state);
            if (stateConfig.restrictsNotebookWriting)
                playerData.notebookWriteRestrictors.delete(state);
            if (stateConfig.restrictsNotebookPassing)
                playerData.notebookPassRestrictors.delete(state);
        }

        await playerData.save();
    },

    async addRoleIfAlive(userId: string, roleName: DiscordRoleName) {
        const userData = await Player.findOne({ userId });
        if (!userData) throw new Error("Player does not exist.");
        if (!userData.flags.get("alive")) return;
        const mainGuild = await client.guilds.fetch(config.guilds.main);
        const member = await mainGuild.members.fetch(userId).catch(() => null);
        if (member) {
            await member.roles
                .add(config.discordRoles[roleName])
                .catch(console.error);
        }
    },

    async deleteTemporaryChannels() {
        const season = await Season.findOne({});
        if (!season) return;

        const promises = season.temporaryChannels.map(async (channelId) => {
            const channel = await client.channels.fetch(channelId);
            await channel?.delete();
        });

        await Promise.allSettled(promises);
    },

    async setChannelLoggable(
        channelId: string,
        toggle: boolean = true
    ): Promise<Result> {
        const season = await Season.findOne({});
        if (!season)
            return failure(
                "Currently, no season exists. A season needs to exist in order for a channel to be made loggable."
            );

        if (toggle) {
            if (season.messageLoggedChannels.includes(channelId))
                return failure("Channel is already considered loggable.");
            await Season.updateOne(
                {},
                { $addToSet: { messageLoggedChannels: channelId } }
            );
            return success("This channel is now loggable.");
        } else {
            if (!season.messageLoggedChannels.includes(channelId))
                return failure("Channel is already unloggable.");
            await Season.updateOne(
                {},
                { $pull: { messageLoggedChannels: channelId } }
            );
            return success("This channel is now unloggable.");
        }
    },

    roleMention(r: RoleName) {
        // Try to find role id from config, fallback to plain text
        const id = config.discordRoles[r];
        return id ? `<@&${id}>` : r;
    },

    hrsToMs(hrs: number) {
        return 1000 * 60 * 60 * hrs;
    },

    minToMs(min: number) {
        return 1000 * 60 * min;
    },

    secToMs(sec: number) {
        return 1000 * sec;
    },
};

export default util;
