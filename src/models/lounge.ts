import { Document, Schema, Model, model } from 'mongoose';

export interface ILounge {
    anonymous?: boolean;
    contactorId: string;
    contactedId: string;
    loungeId: number;
    channelIds: string[]; // array of channel IDs associated with the lounge
}

export interface ILoungeDocument extends ILounge, Document {}

const loungeSchema = new Schema<ILoungeDocument>({
    anonymous: Boolean,
    contactorId: { type: String, required: true },
    contactedId: { type: String, required: true },
    loungeId: { type: Number, required: true },
    channelIds: { type: [String], required: true },
});

const Lounge = model<ILoungeDocument>("lounge", loungeSchema);
export default Lounge;
