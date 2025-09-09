import { Channel, ChannelType, Client, NewsChannel, PermissionOverwriteOptions, PermissionOverwrites, PermissionsBitField, StageChannel, TextChannel, VoiceChannel } from "discord.js";
import Season from "../models/seasonts";
import { config } from "../configs/config";

let client: Client;

export type ChannelPerms = {
    ids: string[],
    perms: PermissionOverwriteOptions
}

const util = {
    init: function (newClient: Client) {
        client = newClient;
    },

    async sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
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

    async addPermissionsToChannel(channelId: string, permissions: ChannelPerms[]) {
        const channel = await client.channels.fetch(channelId);
        if (
            !channel ||
            !(channel instanceof TextChannel ||
            channel instanceof NewsChannel ||
            channel instanceof VoiceChannel ||
            channel instanceof StageChannel)
        ) throw new Error("Channel is not a text, news, voice, or stage channel.");

        const overwrites = channel.permissionOverwrites;
        const promises = permissions.map(async (entry) => {
            for (const id of entry.ids) {
                await overwrites.create(id, entry.perms);
            }
        })
        await Promise.allSettled(promises);
    },

    async deletePermissionsToChannel(channelId: string, ids: string[]) {
        const channel = await client.channels.fetch(channelId);
        if (
            !channel ||
            !(channel instanceof TextChannel ||
            channel instanceof NewsChannel ||
            channel instanceof VoiceChannel ||
            channel instanceof StageChannel)
        ) throw new Error("Channel is not a text, news, voice, or stage channel.");

        const overwrites = channel.permissionOverwrites;
        const promises = ids.map(async (id) => {
            await overwrites.delete(id);
        });
        await Promise.all(promises);
    }
};

export default util;