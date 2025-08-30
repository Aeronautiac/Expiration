const { Events } = require("discord.js");
const Season = require("../models/season");
const Player = require("../models/player");
const gameConfig = require("../../gameconfig.json");

module.exports = {
    name: Events.MessageCreate,

    async execute(message) {
        if (message.author.bot) return;

        const season = await Season.findOne({});
        if (!season) return;

        if (!season.messageLoggedChannels.includes(message.channel.id)) return;

        const senderData = await Player.findOne({ userId: message.author.id });
        if (!senderData) return;
        if (!senderData.bugged) return;

        const bugLogs = await message.client.channels.fetch(
            gameConfig.channelIds.bugLogs
        );

        try {
            await bugLogs.send({
                content: message.content,
                files: [...message.attachments.values()],
            });
        } catch (err) {
            console.log(`Failed to relay bug message`, err);
        }
    },
};
