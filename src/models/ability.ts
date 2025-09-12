import { Document, Schema, Model, model } from "mongoose";
import { PlayerAbilityName } from "../configs/playerAbilities";

// this can be expanded to work with organisations as well.
// add a "type" field which is either "player" or "organisation"
// then, roleRestrictions becomes an array of roles. if it is a player ability, there will only be one role in this array if any.
// if it is an organisation, there may be multiple roles in this array.
// the ownerId field should also become just the "owner" field.

// this will allow us to use most of the same code without repeating everything for orgs.
// we also need to add a system where using one ability causes another ability to be put on cooldown/uses x amount of another ability's charges.

export interface IAbility extends Document {
  type: "player" | "organisation";
  queuedCooldown?: Number;
  owner: string;
  ability: PlayerAbilityName;
  cooldown: number;
  charges?: number;
  roleRestrictions: string[];
}

const abilitySchema = new Schema<IAbility>({
  type: { type: String, required: true },
  roleRestrictions: { type: [String], required: true, default: [] }, // only allow ability to be used while the player has this role.
  queuedCooldown: Number,
  owner: { type: String, required: true }, // abilities may only be used by their owner. each player may only own one copy of an ability at a time.
  ability: { type: String, required: true },
  cooldown: { type: Number, required: true, default: 0 }, // cooldowns are applied at the end of a day if it was used that day.
  charges: Number, // at the end of a day, charges are removed from the ability's data.
});

const Ability: Model<IAbility> = model<IAbility>("ability", abilitySchema);
export default Ability;