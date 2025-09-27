import { Document, Schema, Model, model } from "mongoose";

export interface IGroupChat extends Document {
    channelId: string;
    ownerId: string;
    memberIds: string[];
}

const groupChatSchema: Schema = new Schema<IGroupChat>({
    channelId: { type: String, required: true },
    ownerId: { type: String, required: true },
    memberIds: { type: [String], required: true, default: [] },
});

const GroupChat: Model<IGroupChat> = model<IGroupChat>("groupChat", groupChatSchema);
export default GroupChat;