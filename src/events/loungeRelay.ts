import { Events, Message } from "discord.js";
import Season from "../models/season";
import util from "../core/util";
import names from "../core/names";
import Player from "../models/player";
import Lounge from "../models/lounge";

export default {
    name: Events.MessageCreate,

    async execute(message: Message) {
        if (message.author.bot) return;

        const season = await Season.findOne({});
        if (!season) return;

        // do not send if the bugged person is dead or doesnt exist for some reason
        const senderData = await Player.findOne({ userId: message.author.id });
        if (!senderData) return;
        if (!senderData.flags.get("alive")) return;

        const lounge = await Lounge.findOne({
            channelIds: message.channelId,
        });
        if (!lounge) return;

        const channelsToSendTo = lounge.channelIds.filter(
            (channelId) => channelId !== message.channelId
        );
        if (channelsToSendTo.length === 0) return;

        const senderName =
            lounge.anonymous && message.author.id === lounge.contactorId
                ? senderData.role
                : await names.getAlias(message.author.id);
        await util.relayMessage(
            message,
            channelsToSendTo,
            `**${senderName}**: `
        );
    },
};
