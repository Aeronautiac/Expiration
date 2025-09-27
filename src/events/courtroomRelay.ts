import { Events, Message } from "discord.js";
import Season from "../models/season";
import util from "../core/util";
import names from "../core/names";
import Player from "../models/player";
import { config } from "../configs/config";

export default {
    name: Events.MessageCreate,

    async execute(message: Message) {
        if (message.author.bot) return;

        const season = await Season.findOne({});
        if (!season) return;

        const isRelay =
            message.channelId === config.channels.anonymousCourtroom;
        const isCourtroom = message.channelId === config.channels.courtroom;
        if (!isRelay && !isCourtroom) return;

        const senderData = await Player.findOne({ userId: message.author.id });
        const senderName =
            isRelay && senderData
                ? util.roleMention(senderData.role)
                : `**${await names.getDisplay(message.author.id)}**`;
        await util.relayMessage(
            message,
            [
                isRelay
                    ? config.channels.courtroom
                    : config.channels.anonymousCourtroom,
            ],
            `${senderName}: `
        );
    },
};
