import { Document, Schema, Model, model } from "mongoose";

export type PollData = Record<string, unknown>;
export type PollCallbacks = {
    threshold: string;
    resolve: string;
    filter: string;
    canContinue: string;
};
export type PollResolutionRules = {
    prioritizeInconclusive: boolean; // if the poll times out and this value is false, then it will return inconclusive without checking votes
    resolveAt: number;
    resolvesOnThreshold: boolean;
};
export type PollLocation = {
    channelId: string;
    messageId: string;
};

export interface IPoll extends Document {
    resolutionRules?: PollResolutionRules;
    identifier: string;
    callbacks: PollCallbacks;
    data: PollData;
    location: PollLocation;
}

const pollSchema = new Schema<IPoll>({
    resolutionRules: {
        allowInconclusive: { type: Boolean, required: true },
        resolveAt: { type: Number, required: true },
        resolvesOnThreshold: { type: Boolean, required: true },
    },
    identifier: { type: String, required: true },
    callbacks: {
        type: {
            threshold: { type: String, required: true },
            resolve: { type: String, required: true },
            filter: { type: String, required: true },
            canContinue: { type: String, required: true },
        },
        required: true,
    },
    location: {
        type: {
            messageId: { type: String, required: true },
            channelId: { type: String, required: true },
        },
        required: true,
    },
    data: { type: Schema.Types.Mixed, required: true, default: {} },
});
const Poll: Model<IPoll> = model<IPoll>("poll", pollSchema);
export default Poll;
