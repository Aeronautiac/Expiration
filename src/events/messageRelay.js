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
        if (
            authorMember.permissions.has(
                PermissionsBitField.Flags.Administrator
            )
        )
            return;
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
        const kidnapLounge = await KidnapLounge.findOne({
            channelIds: message.channel.id,
        }).catch(() => null);
        const otherChannel = kidnapLounge?.channelIds.find(
            (id) => id !== message.channel.id
        );

        if (otherChannel) {
            const sentByText = kidnapLounge.kidnapperId
                ? "???"
                : game.strippedName(authorMember.displayName);
            let sendText = `${sentByText}: ${message.content}`;
            try {
                const targetChannel = await message.client.channels.fetch(
                    otherChannel
                );
                if (targetChannel?.isTextBased()) {
                    await targetChannel.send({
                        content: sendText,
                        files: [...message.attachments.values()],
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
