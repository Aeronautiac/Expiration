const { mongoose } = require("../mongoose");

const abilitySchema = new mongoose.Schema({
    persistsThroughRoleChange: { type: Boolean, required: true, default: false },
    usedToday: { type: Boolean, required: true, default: false },
    ownerId: { type: String, required: true }, // abilities may only be used by their owner. each player may only own one copy of an ability at a time.
    ability: { type: String, required: true },
    cooldown: { type: Number, required: true, default: 0 }, // cooldowns are applied at the end of a day if it was used that day.
    charges: Number, // at the end of a day, charges are removed from the ability's data.
});

const Ability = mongoose.model("ability", abilitySchema);
module.exports = Ability;
