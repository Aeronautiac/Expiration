import { Document, Schema, Model, model } from "mongoose";
import { PlayerAbilityName } from "../configs/playerAbilities";

export interface IAbility extends Document {
  queuedCooldown?: Number;
  ownerId: string;
  ability: PlayerAbilityName;
  cooldown: number;
  charges?: number;
  roleRestriction?: string;
}

export interface IAbilityDocument extends IAbility, Document { }

const abilitySchema = new Schema<IAbility>({
  roleRestriction: String, // only allow ability to be used while the player has this role.
  queuedCooldown: Number,
  ownerId: { type: String, required: true }, // abilities may only be used by their owner. each player may only own one copy of an ability at a time.
  ability: { type: String, required: true },
  cooldown: { type: Number, required: true, default: 0 }, // cooldowns are applied at the end of a day if it was used that day.
  charges: Number, // at the end of a day, charges are removed from the ability's data.
});

const Ability: Model<IAbilityDocument> = model<IAbilityDocument>("ability", abilitySchema);
export default Ability;