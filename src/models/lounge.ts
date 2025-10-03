import { Document, Schema, Model, model } from 'mongoose';

export interface ILounge {
    anonymous?: boolean;
    contactorId: string;
    contactedId: string;
    loungeId: number;
    channelIds: string[]; // array of channel IDs associated with the lounge
}
const loungeSchema = new Schema<ILounge>({
    anonymous: Boolean,
    contactorId: { type: String, required: true },
    contactedId: { type: String, required: true },
    loungeId: { type: Number, required: true },
    channelIds: { type: [String], required: true },
});

const Lounge = model<ILounge>("lounge", loungeSchema);
export default Lounge;
