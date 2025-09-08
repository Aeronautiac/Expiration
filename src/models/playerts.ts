import { Document, Schema, Model, model } from "mongoose";

export type PlayerFlag = "ipp" | "custody" | "incarcerated" | "underTheRadar" | "notebookUnlocked" | "alive";
export type GameRole = "Kira" | "2nd Kira" | "Civilian" | "News Anchor" | "Rogue Civilian" | "Beyond Birthday" | "Private Investigator" | "L" | "Watari"

// Interface representing a player
export interface IPlayer {
    userId: string;
    trueName: string;
    role: GameRole;
    loungeChannelIds: string[];
    contactTokens: number;
    monologueChannelId?: string;
    cooldowns: Map<string, number>;
    affiliations: string[];
    loungeHiders: Map<string, boolean>;
    notebookRestrictors: Map<string, boolean>;
    abilityRestrictors: Map<string, boolean>;
    flags: Map<PlayerFlag, boolean>;
    timeOfDeath?: number;
    eyes: number;
    invites: Map<string, string>;
}

// Interface for Mongoose Document
export interface IPlayerDocument extends IPlayer, Document {}

// Schema
const playerSchema = new Schema<IPlayerDocument>({
    userId: { type: String, required: true, unique: true },
    trueName: { type: String, required: true, unique: true },
    role: { type: String, required: true },
    loungeChannelIds: { type: [String], required: true, default: [] },
    contactTokens: { type: Number, required: true },
    monologueChannelId: String,
    cooldowns: { type: Map, of: Number, required: true, default: {} },
    affiliations: { type: [String], required: true, default: [] },
    loungeHiders: { type: Map, of: String, required: true, default: {} },
    notebookRestrictors: { type: Map, of: String, required: true, default: {} },
    abilityRestrictors: { type: Map, of: Boolean, required: true, default: {} },
    flags: { type: Map, of: Boolean, required: true, default: {} },
    timeOfDeath: Number,
    eyes: { type: Number, required: true, default: 2 },
    invites: { type: Map, of: String, required: true, default: {} },
});

// Model
const Player: Model<IPlayerDocument> = model<IPlayerDocument>("Player", playerSchema);

export default Player;