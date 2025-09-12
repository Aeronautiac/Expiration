import { Document, Schema, Model, model } from "mongoose";

export type PollData = Record<string, unknown>;
export type PollCallbacks = {
    threshold: string;
    resolve: string;
    filter: string;
};
export type PollLifetime = {
    allowInconclusive: boolean; // if the poll times out and this value is false, then 
    resolveAt: number;
};

export interface IPoll extends Document {
    lifetime?: PollLifetime;
    identifier: string;
    callbacks: PollCallbacks;
    data: PollData;
    messageId: string;
};

const pollSchema = new Schema<IPoll>({
    lifetime: {
        allowInconclusive: Boolean,
        resolveAt: Number,
    },
    identifier: { type: String, required: true },
    callbacks: {
        type: {
            threshold: String,
            resolve: String,
            filter: String,
        }, required: true
    },
    messageId: { type: String, required: true, },
    data: { type: Schema.Types.Mixed, required: true, default: {} }
});
const Poll: Model<IPoll> = model<IPoll>("poll", pollSchema);
export default Poll;