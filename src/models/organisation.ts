import { Document, Schema, Model, model } from "mongoose";

export interface IOrganisation {
    name: string;
    leaderId?: string; // userId of the leader (if any)
    memberIds: string[]; // array of userIds of members
}

export interface IOrganisationDocument extends IOrganisation, Document {}

const organisationSchema = new Schema<IOrganisationDocument>({
    name: { type: String, required: true },
    leaderId: String,
    memberIds: { type: [String], required: true, default: [] },
});

const Organisation: Model<IOrganisationDocument> = model<IOrganisationDocument>("Organisation", organisationSchema);

export default Organisation;
