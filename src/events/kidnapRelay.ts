import { Events, Message } from "discord.js";
import Season from "../models/season";
import { config } from "../configs/config";
import util from "../core/util";
import names from "../core/names";
import Kidnapping from "../models/kidnapping";
import Player from "../models/player";

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

        // if sent from a victim lounge, then nothing should be hidden
        const victim = await Kidnapping.findOne({
            kidnappedChannelId: message.channelId,
        });
        if (victim) {
            const senderName = await names.getAlias(message.author.id);
            await util.relayMessage(
                message,
                [victim.kidnapperChannelId],
                `**${senderName}:** `
            );
            return;
        }

        // if sent from kidnapper lounge, then things should be hidden if anonymous
        const kidnapper = await Kidnapping.findOne({
            kidnapperChannelId: message.channelId,
        });
        if (kidnapper) {
            const name = kidnapper.kidnapperId ? await names.getAlias(message.author.id) : "???";
            await util.relayMessage(
                message,
                [kidnapper.kidnappedChannelId],
                `**${name}:** `
            );
            return;
        }
    },
};
