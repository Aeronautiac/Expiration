import { Client } from "discord.js";
import Poll, { IPoll, PollCallbacks, PollData, PollLifetime } from "../models/poll";

export type Resolution = "inconclusive" | "success" | "failure";

let client: Client;

const module = {
    init(c: Client) {
        client = c;
    },

    async update(poll: IPoll) {
        const timeNow = Date.now();
        // find the poll's current threshold using the threshold callback,
        // find the number of valid voters for either success or failure
        // check if the poll has timed out, then check if the poll allows inconclusive outcomes.
        // if it doesn't allow inconclusive outcomes, then resolve with the outcome with the highest valid voter count
        // otherwise,
        // if one option passes threshold, then resolve with "success"
        // if both options pass threshold, then resolve with the outcome that has the most votes
    },

    async updateAll() {
        const allPolls = await Poll.find({});
        const pollUpdatePromises = allPolls.map(async (poll) => {
            await this.update(poll).catch(console.error);
        });
        await Promise.all(pollUpdatePromises);
    },

    // think about case with multiple of the same identifier.
    // should this be allowed?
    async create(identifier: string, callbacks: PollCallbacks, data: PollData = {}, lifetime: PollLifetime) {
    },

    // if we do decide to allow multiple of the same identifier
    // then how do we determine which to cancel? differentiate using data maybe?
    // if we differentiate based on both identifier and data, then identifier should
    // probably renamed to "name"
    async cancel(identifier: string) {
        await Poll.findOneAndDelete({ identifier });
    },

    // starts the poll update loop
    start() {}
};

export default module;