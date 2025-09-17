import { Document, Schema, Model, model } from "mongoose";

export interface INotebook {
    guildId: string;
    originalOwner: string;
    currentOwner: string;
    temporaryOwner?: string;
    usedToday: string[],
    attemptsToday: Map<string, number>;
}

export interface INotebookDocument extends INotebook, Document {}

const notebookSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    originalOwner: { type: String, required: true },
    currentOwner: { type: String, required: true },
    temporaryOwner: { type: String },
    usedToday: { type: [String], required: true, default: [] }, // an array of user ids who have killed someone using this notebook today. reset when the day ends.
    attemptsToday: { type: Map, of: Number, default: {}, required: true }, // the number of times somebody has tried and failed to use the notebook today. resets on day end.
});

const Notebook: Model<INotebookDocument> = model<INotebookDocument>("Notebook", notebookSchema);

export default Notebook;
