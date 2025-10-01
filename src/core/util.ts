import {
    APIApplicationCommandOptionChoice,
    Channel,
    ChannelType,
    Client,
    Message,
    NewsChannel,
    PermissionOverwriteOptions,
    roleMention,
    StageChannel,
    TextChannel,
    VoiceChannel,
} from "discord.js";
import Season from "../models/season";
import { config } from "../configs/config";
import { PlayerStateName } from "../configs/playerStates";
import Player from "../models/player";
import contacting from "./contacting";
import { DiscordRoleName, discordRoles } from "../configs/discordRoles";
import { RoleName } from "../configs/roles";
import { failure, Result, success } from "../types/Result";
import Organisation from "../models/organisation";
import { OrgMember } from "../types/OrgMember";
import { OrganisationName } from "../configs/organisations";
import { configDotenv } from "dotenv";

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
        perms: ChannelPerms[] = [],
        hidden?: boolean
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

        // put the channel in the category
        await newChannel.setParent(chosenCategory);

        // add perms
        if (hidden)
            perms.push({
                ids: [guild.roles.everyone.id],
                perms: {
                    ViewChannel: false,
                },
            });

        await util.addPermissionsToChannel(newChannel.id, perms);

        season.temporaryChannels.push(newChannel.id);
        await season.save();

        return newChannel;
    },

    async deleteTemporaryChannels() {
        const season = await Season.findOne({});
        if (!season) return;

        const deletePromises = season.temporaryChannels.map(
            async (channelId) => {
                const channel: Channel | null = await client.channels
                    .fetch(channelId)
                    .catch(() => null);
                if (channel) await channel.delete().catch(console.error);
            }
        );
        await Promise.all(deletePromises);
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

    async getMemberObjects(userId: string) {
        const memberOfOrgs = await Organisation.find({ memberIds: userId });

        const objects: OrgMember[] = [];
        for (const org of memberOfOrgs) {
            const obj: OrgMember = {
                org: org.name as OrganisationName,
                leader: org.leaderId === userId,
            };
            objects.push(obj);
        }

        return objects;
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

    async relayMessage(
        message: Message,
        channelIds: string[],
        prefix: string = ""
    ) {
        const content = `${prefix}${message.content}`;
        const channelSendPromises = channelIds.map(async (channelId) => {
            const channel = await client.channels.fetch(channelId);
            if (channel.isSendable()) {
                await channel.send({
                    content,
                    files: [...message.attachments.values()],
                });
            }
        });
        await Promise.allSettled(channelSendPromises);
    },

    async fetchAllMessages(
        channelId: string,
        earliestTimestamp?: number,
        predicate: (msg: Message) => boolean = () => true
    ) {
        const channel = await client.channels.fetch(channelId);
        if (!channel.isTextBased())
            throw new Error(
                "Channel must be text based in order to fetch messages."
            );

        let allMessages: Message[] = [];
        let lastId: string;
        let done = false;

        while (!done) {
            const options: {
                limit: number;
                before: string;
            } = {
                limit: 100,
                before: null,
            };
            if (lastId) options.before = lastId;

            const messages = await channel.messages.fetch(options);
            if (messages.size === 0) break;

            for (const msg of Array.from(messages.values())) {
                if (
                    earliestTimestamp &&
                    msg.createdTimestamp < earliestTimestamp
                ) {
                    done = true; // all remaining messages are too old
                    break;
                }
                if (predicate(msg)) allMessages.push(msg);
            }

            lastId = messages.last().id;
        }

        return allMessages;
    },

    // this function will tokenize long messages and send them in chunks.
    // eventually I plan to make it include formatting and everything.
    async sendMessage(channelId: string, message: string) {},

    async produceListOfRoles(includeTrueNames: boolean = false): Promise<string> {
        const getTrueNameIfNeededHelper = async (userId: string): Promise<string> => {
            return new Promise(async (resolve, reject) => {
                const playerData = await Player.findOne({ userId });
                if (playerData) {
                    if (includeTrueNames) {
                        resolve(`<@${userId}> (${playerData.trueName})`);
                    } else {
                        resolve(`<@${userId}>`);
                    }
                } else {
                    reject("Player not found");
                }
            });
        }

        const rolesInOrder = [
            "Kira",
            "2nd Kira",
            "",
            "L",
            "Watari",
            "",
            "Beyond Birthday",
            "Rogue Civilian",
            "Private Investigator",
            "News Anchor",
        ];
        const orgsInOrder = ["Kira's Kingdom", "Task Force"];

        let roleRevealMessage = `The roles for this season:\n\n`;

        for (const roleName of rolesInOrder) {
            if (roleName === "") {
                roleRevealMessage += `\n`;
                continue;
            }

            const playerData = await Player.findOne({ role: roleName });
            if (playerData) {
                roleRevealMessage += `<@&${discordRoles[roleName]}> -- ${await getTrueNameIfNeededHelper(playerData.userId)}\n`;
            }
        }

        for (const orgName of orgsInOrder) {
            const orgData = await Organisation.findOne({ name: orgName });
            roleRevealMessage += `\nThe original members for <@&${discordRoles[orgName]}>:\n`;
            for (const memberId of orgData.ogMemberIds) {
                roleRevealMessage += await getTrueNameIfNeededHelper(memberId) + "\n";
            }
        }

        return roleRevealMessage;
    },

    interactionChoice(
        choice: string
    ): APIApplicationCommandOptionChoice<string> {
        return {
            name: choice,
            value: choice,
        };
    },

    roleMention(r: DiscordRoleName, guildId: string = config.guilds.main) {
        // Try to find role id from config, fallback to plain text
        const id = config.discordRoles[r];
        return id && guildId === config.guilds.main ? `<@&${id}>` : `**${r}**`;
    },

    orgMention(org: OrganisationName, guildId?: string) {
        return util.roleMention(org, guildId);
    },

    articledOrgMention(org: OrganisationName, guildId?: string) {
        const article = config.organisations[org]["article"];
        const start = article ? article + " " : ``;
        const orgPing = util.orgMention(org, guildId);
        return `${start}${orgPing}`;
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

    toTitleCase(str: string) {
        return str
            .toLowerCase()
            .trim() // remove leading/trailing spaces and newlines
            .split(/\s+/) // split on any whitespace (spaces, tabs, newlines)
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)) // capitalize first letter of each word
            .join(" "); // join with single space
    },
};

export default util;
