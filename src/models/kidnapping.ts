import { Document, Schema, Model, model } from "mongoose";

export interface IKidnapping extends Document {
    victimId: string;
    kidnapperId?: string;
    kidnapperChannelId: string;
    kidnappedChannelId: string;
}

const kidnappingSchema = new Schema<IKidnapping>({
    victimId: { type: String, required: true, unique: true },
    kidnapperId: String,
    kidnapperChannelId: { type: String, required: true },
    kidnappedChannelId: { type: String, required: true },
});

const Kidnapping: Model<IKidnapping> = model<IKidnapping>("kidnapping", kidnappingSchema);
export default Kidnapping;