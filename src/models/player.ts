import { Document, Schema, Model, model } from "mongoose";
import { RoleName } from "../configs/roles";
import { PlayerStateName } from "../configs/playerStates";

export type ExtraPlayerFlag = "ipp" | "underTheRadar" | "kiraConnection" | "kiraConnectionCooldown" | "alive" | "didPublicKidnap" | "spectator";
export type PlayerFlag = ExtraPlayerFlag | PlayerStateName;

// Interface representing a player
export interface IPlayer {
    userId: string;
    trueName: string;
    role: RoleName;
    loungeChannelIds: string[];
    contactTokens: number;
    monologueChannelId?: string;
    cooldowns: Map<string, number>;
    loungeHiders: Map<string, boolean>;
    notebookWriteRestrictors: Map<string, boolean>;
    notebookPassRestrictors: Map<string, boolean>;
    abilityRestrictors: Map<string, boolean>;
    flags: Map<PlayerFlag, boolean>;
    timeOfDeath?: number;
    eyes: number;
    invites: Map<string, string>;
    playersKilled: string[]; // array of userIds of players this player has killed;
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
    loungeHiders: { type: Map, of: String, required: true, default: {} },
    notebookWriteRestrictors: { type: Map, of: String, required: true, default: {} },
    notebookPassRestrictors: { type: Map, of: String, required: true, default: {} },
    abilityRestrictors: { type: Map, of: Boolean, required: true, default: {} },
    flags: { type: Map, of: Boolean, required: true, default: {} },
    timeOfDeath: Number,
    eyes: { type: Number, required: true, default: 2 },
    invites: { type: Map, of: String, required: true, default: {} },
    playersKilled: { type: [String], required: true, default: [] },
});

// Model
const Player: Model<IPlayerDocument> = model<IPlayerDocument>("Player", playerSchema);

export default Player;