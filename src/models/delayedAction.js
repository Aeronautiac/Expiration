const { mongoose } = require("../mongoose");

const delayedActionSchema = new mongoose.Schema({
    // universal
    timeBegan: { type: Number, required: true },
    delay: { type: Number, required: true },
    actionName: { type: String, required: true },

    // ability stuff
    targetId: { type: String },

    // pseudocide
    role: String,

    // scheduled deaths
    deathMessage: String,
    writtenBy: String,
});

const DelayedAction = mongoose.model("delayedAction", delayedActionSchema);
module.exports = DelayedAction;
