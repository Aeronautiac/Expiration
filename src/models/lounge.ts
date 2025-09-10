import { Document, Schema, Model, model } from 'mongoose';

export interface ILounge {
    loungeId: number;
    channelIds: string[]; // array of channel IDs associated with the lounge
}

const loungeSchema = new Schema<ILounge>({
    loungeId: { type: Number, required: true },
    channelIds: { type: [String], required: true }, // if there are multiple channel ids, then the bot will relay messages between the channels
});

const Lounge = model<ILounge>("lounge", loungeSchema);
export default Lounge;
