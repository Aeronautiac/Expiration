import { Events, Message } from "discord.js";
import Season from "../models/season";
import Bug from "../models/bug";
import util from "../core/util";
import names from "../core/names";
import Player from "../models/player";

module.exports = {
    name: Events.MessageCreate,

    async execute(message: Message) {
        if (message.author.bot) return;

        const season = await Season.findOne({});
        if (!season) return;
        if (!season.messageLoggedChannels.includes(message.channel.id)) return;

        // do not send if the bugged person is dead or doesnt exist for some reason
        const senderData = await Player.findOne({userId: message.author.id});
        if (!senderData) return;
        if (!senderData.flags.get("alive")) return;

        const senderName = await names.getAlias(message.author.id);

        const bugs = await Bug.find({
            targetId: message.author.id,
        });

        const relayPromises = bugs.map(async (bug) => {
            await util.relayMessage(
                message,
                Array.from(bug.channelIds.values()),
                `**${senderName}:** `
            );
        });
        await Promise.allSettled(relayPromises);
    },
};
