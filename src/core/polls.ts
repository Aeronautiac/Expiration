import { Client, Message, TextChannel, User } from "discord.js";
import Poll, {
    IPoll,
    PollCallbacks,
    PollData,
    PollLocation,
    PollResolutionReason,
    PollResolutionRules,
} from "../models/poll";
import util from "./util";
import { config } from "../configs/config";
import pollCallbacks from "./pollCallbacks";

let client: Client;

const polls = {
    init(c: Client) {
        client = c;
    },

    async resolve(poll: IPoll, resolution: PollResolutionReason) {
        const resolveCallback = pollCallbacks.resolve[poll.callbacks.resolve];
        await resolveCallback(poll);
        await polls.cancel(poll.identifier, poll.data);
    },

    async update(poll: IPoll) {
        // get the poll's message. if the message doesn't exist anymore, cancel the poll.
        const channel = (await client.channels
            .fetch(poll.location.channelId)
            .catch(() => null)) as TextChannel;
        if (!channel) {
            await polls.resolve(poll, "cancelled");
            return;
        }
        const message = await channel.messages
            .fetch(poll.location.messageId)
            .catch(() => null);
        if (!message) {
            await polls.resolve(poll, "cancelled");
            return;
        }

        const timeNow = Date.now();
        const thresholdCallback =
            pollCallbacks.threshold[poll.callbacks.threshold];
        const filterCallback = pollCallbacks.filter[poll.callbacks.filter];
        const canContinueCallback = pollCallbacks.canContinue[poll.callbacks.canContinue];

        // if the poll cannot continue, resolve with "cancelled"
        if (!canContinueCallback(poll)) {
            await polls.resolve(poll, "cancelled");
            return;
        }

        // find the poll's current threshold using the threshold callback
        const threshold = await thresholdCallback(poll);

        // find the number of valid voters for either success or failure
        const acceptReactions = message.reactions.cache.get(
            config.pollYesEmoji
        );
        const rejectReactions = message.reactions.cache.get(config.pollNoEmoji);

        const acceptUsers = await acceptReactions.users.fetch();
        const rejectUsers = await rejectReactions.users.fetch();

        const validAcceptUsersPromises = acceptUsers.map(async (user: User) => {
            const valid = await filterCallback(poll, user.id);
            if (valid) return user;
        });
        const validRejectUsersPromises = rejectUsers.map(async (user: User) => {
            const valid = await filterCallback(poll, user.id);
            if (valid) return user;
        });
        const validAcceptUsers = (
            await Promise.all(validAcceptUsersPromises)
        ).filter(Boolean);
        const validRejectUsers = (
            await Promise.all(validRejectUsersPromises)
        ).filter(Boolean);

        // check if the poll has timed out, then check if the poll allows inconclusive outcomes.
        // if it doesn't allow inconclusive outcomes, then resolve with the outcome with the highest valid voter count
        if (poll.resolutionRules && timeNow >= poll.resolutionRules.resolveAt) {
            // default to inconclusive
            if (poll.resolutionRules.prioritizeInconclusive)
                await polls.resolve(poll, "inconclusive");
            else {
                // accept/reject, inconclusive if equal
                if (validAcceptUsers.length > validRejectUsers.length)
                    await polls.resolve(poll, "accepted");
                else if (validRejectUsers.length > validAcceptUsers.length)
                    await polls.resolve(poll, "rejected");
                else await polls.resolve(poll, "inconclusive");
            }
            return;
        }

        // if poll does not allow early resolutions, return
        if (poll.resolutionRules && !poll.resolutionRules.resolvesOnThreshold)
            return;

        // if both options pass threshold, then resolve with the outcome that has the most votes
        if (
            validAcceptUsers.length >= threshold &&
            validRejectUsers.length >= threshold
        ) {
            const outcome: PollResolutionReason =
                validAcceptUsers.length > validRejectUsers.length
                    ? "accepted"
                    : "rejected";
            await polls.resolve(poll, outcome);
            return;
        }

        // if only one option passes threshold, then resolve with "success"
        if (validAcceptUsers.length >= threshold)
            await polls.resolve(poll, "accepted");

        if (validRejectUsers.length >= threshold)
            await polls.resolve(poll, "rejected");
    },

    async updateAll() {
        const allPolls = await Poll.find({});
        const pollUpdatePromises = allPolls.map(async (poll) => {
            await polls.update(poll).catch(console.error);
        });
        await Promise.all(pollUpdatePromises);
    },

    async create(
        location: PollLocation,
        identifier: string,
        callbacks: PollCallbacks,
        data: PollData = {},
        resolutionRules: PollResolutionRules
    ) {
        const channel = await client.channels
            .fetch(location.channelId)
            .catch(() => null);
        if (!channel) throw new Error("This is not a valid channel id.");
        if (!channel.isTextBased())
            throw new Error("Channel must be text based.");

        const message: Message = location.messageId ? await channel.messages
            .fetch(location.messageId)
            .catch(() => null)
            :
            channel.send(location.messageContent);
        if (!message) throw new Error("This is not a valid message id.");

        await message.react(config.pollYesEmoji);
        await message.react(config.pollNoEmoji);

        return await Poll.create({
            location: {
                messageId: message.id,
                channelId: channel.id
            },
            identifier,
            callbacks,
            data,
            resolutionRules,
        });
    },

    async cancel(identifier: string, data: PollData = {}) {
        await Poll.deleteMany({ identifier, data });
    },

    // starts the poll update loop
    start() {
        let running = false;

        const loop = async () => {
            if (running) return;
            running = true;

            try {
                await polls.updateAll();
            } catch (err) {
                console.error(err);
            } finally {
                running = false;
            }
        };

        loop(); // run immediately
        setInterval(loop, util.secToMs(config.pollUpdateRate));
    },
};

export default polls;
