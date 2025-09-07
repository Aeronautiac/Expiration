const { Events, PermissionsBitField } = require("discord.js");
const Lounge = require("../models/lounge");
const KidnapLounge = require("../models/kidnaplounge");
const gameConfig = require("../../gameconfig.json");
const game = require("../game");

module.exports = {
    name: Events.MessageCreate,

    async execute(message) {
        const mainGuild = await message.client.guilds.fetch(
            gameConfig.guildIds.main
        );
        const authorMember = await mainGuild.members
            .fetch(message.author.id)
            .catch(() => null);
        if (!authorMember) return;
        if (message.author.bot) return;

        // multi-channel lounges
        const lounge = await Lounge.findOne({ channelIds: message.channel.id });
        if (lounge) {
            for (const channelId of lounge.channelIds) {
                if (channelId === message.channel.id) continue; // skip the sender's channel

                try {
                    const targetChannel = await message.client.channels.fetch(
                        channelId
                    );
                    if (targetChannel?.isTextBased()) {
                        await targetChannel.send({
                            content: message.content,
                            files: [...message.attachments.values()],
                            split: true,
                        });
                    }
                } catch (err) {
                    console.warn(
                        `Failed to relay message to ${channelId}:`,
                        err.message
                    );
                }
            }
        }

        // kidnap lounges
        let kidnapLounge =
            (await KidnapLounge.findOne({
                kidnappedChannelId: message.channel.id,
            }).catch(() => null)) ||
            (await KidnapLounge.findOne({
                kidnapperChannelId: message.channel.id,
            }).catch(() => null));

        if (kidnapLounge) {
            const otherChannel =
                message.channel.id === kidnapLounge.kidnappedChannelId
                    ? kidnapLounge.kidnapperChannelId
                    : kidnapLounge.kidnappedChannelId;

            const authorName = game.strippedName(authorMember.displayName);
            let sentByText;
            if (kidnapLounge.kidnapperId) {
                sentByText = authorName;
            } else {
                if (message.author.id === kidnapLounge.victimId)
                    sentByText = authorName;
                else {
                    if (message.channel.id === kidnapLounge.kidnapperChannelId)
                        sentByText = `???`;
                    else sentByText = authorName;
                }
            }

            let sendText = `**${sentByText}:** ${message.content}`;
            try {
                const targetChannel = await message.client.channels.fetch(
                    otherChannel
                );
                if (targetChannel?.isTextBased()) {
                    await targetChannel.send({
                        content: sendText,
                        files: [...message.attachments.values()],
                        split: true,
                    });
                }
            } catch (err) {
                console.warn(
                    `Failed to relay message to ${otherChannel}:`,
                    err.message
                );
            }
        }
    },
};
