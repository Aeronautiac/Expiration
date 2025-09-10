import { Document, Schema, Model, model } from "mongoose";

export interface IKidnapping extends Document {
    victimId: string;
    kidnapperId?: string;
    kidnapperChannelId: string;
    kidnappedChannelId: string;
}

export interface IKidnapDocument extends IKidnapping, Document {}

const kidnappingSchema= new Schema<IKidnapping>({
    victimId: { type: String, required: true, unique: true },
    kidnapperId: String,
    kidnapperChannelId: { type: String, required: true },
    kidnappedChannelId: { type: String, required: true },
});

const Kidnapping: Model<IKidnapDocument> = model<IKidnapDocument>("kidnapping", kidnappingSchema);
export default Kidnapping;