import { Document, Schema, Model, model } from "mongoose";
import { RoleName } from "../configs/roles";

export interface ILounge {
    anonymousAsRole?: RoleName;
    fake?: boolean;
    owner?: string;
    contactorChannelId?: string;
    contactedChannelId?: string;
    contactorId: string;
    contactedId: string;
    loungeId: number;
    channelIds: string[]; // array of channel IDs associated with the lounge
}
const loungeSchema = new Schema<ILounge>({
    anonymousAsRole: String,
    fake: Boolean,
    owner: String,
    contactorChannelId: String,
    contactedChannelId: String,
    contactorId: { type: String, required: true },
    contactedId: { type: String, required: true },
    loungeId: { type: Number, required: true },
    channelIds: { type: [String], required: true },
});

const Lounge = model<ILounge>("lounge", loungeSchema);
export default Lounge;
