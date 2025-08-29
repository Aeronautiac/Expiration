const { Events } = require("discord.js");
const Lounge = require("../models/lounge");

module.exports = {
    name: Events.MessageCreate,

    async execute(message) {
        if (message.author.bot) return;

        const lounge = await Lounge.findOne({ channelIds: message.channel.id });
        if (!lounge) return;

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
    },
};
