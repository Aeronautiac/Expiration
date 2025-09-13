const { mongoose } = require("../mongoose");import { Document, Schema, Model, model } from "mongoose";

export type SeasonFlag = "active" | "blackout";

export interface ISeason extends Document {
    temporaryChannels: string[]; // array of channel ids
    messageLoggedChannels: string[]; // an array of channel ids of which messages are logged through abilities like bug and autopsy
    day: number; // starts day 1
    flags: Map<SeasonFlag, boolean>;
};

// will hold game state like channels that were dynamically created during the season, blackout, etc...
// there will only be one of these at a time
const seasonSchema = new mongoose.Schema({
    _id: { type: String, default: "season" },
    flags: { type: Map, of: Boolean, required: true, default: {} },
    temporaryChannels: { type: [String], required: true, default: [] },
    messageLoggedChannels: { type: [String], required: true, default: [] }, // an array of channel ids of which messages are logged through abilities like bug and autopsy
    day: { type: Number, required: true, default: 1 }, // starts day 1
});

const Season: Model<ISeason> = model<ISeason>("season", seasonSchema);
export default Season;