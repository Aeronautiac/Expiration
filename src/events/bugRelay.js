const { Events } = require("discord.js");
const Season = require("../models/season");
const BugLog = require("../models/bugLog");
const gameConfig = require("../../gameconfig.json");
const game = require("../game");

module.exports = {
    name: Events.MessageCreate,

    async execute(message) {
        if (message.author.bot) return;

        const season = await Season.findOne({});
        if (!season) return;

        if (!season.messageLoggedChannels.includes(message.channel.id)) return;

        const mainGuild = await message.client.guilds.fetch(
            gameConfig.guildIds.main
        );
        const member = await mainGuild.members
            .fetch(message.author.id)
            .catch(() => null);

        const bugLogs = await BugLog.find({
            targetId: message.author.id,
        });

        for (const bugLog of bugLogs) {
            try {
                const channelIds = [...bugLog.channelIds.values()];
                for (const channelId of channelIds) {
                    const channel = await message.client.channels.fetch(
                        channelId
                    );
                    if (!channel) continue;
                    await channel.send({
                        content: `**${
                            member
                                ? game.strippedName(member.displayName)
                                : message.author.username
                        }:** ${message.content}`,
                        files: [...message.attachments.values()],
                        split: true,
                    });
                }
            } catch (err) {
                console.log(`Failed to relay bug message`, err);
            }
        }
    },
};
