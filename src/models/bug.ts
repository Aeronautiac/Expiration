import { Document, Schema, Model, model } from "mongoose";

export interface IBug extends Document {
    buggedBy?: string;
    targetId: string;
    source: string;
    channelIds: Map<string, string>;
}

const bugSchema = new Schema<IBug>({
    buggedBy: String,
    targetId: { type: String, required: true },
    channelIds: { type: Map, of: String, required: true, default: {} }, // map of channel aliases to channelIds
    source: { type: String, required: true },
});

const Bug: Model<IBug> = model<IBug>("bug", bugSchema);
export default Bug;
