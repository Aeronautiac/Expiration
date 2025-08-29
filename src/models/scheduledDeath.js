const { mongoose } = require("../mongoose");

// will hold game state like channels that were dynamically created during the season, blackout, etc...
// there will only be one of these at a time
const scheduledDeathShema = new mongoose.Schema({
    time: { type: Number, required: true },
    target: { type: String, required: true },
    deathMessage: { type: String },
    writtenBy: { type: String, required: true },
});

const ScheduledDeath = mongoose.model("scheduledDeath", scheduledDeathShema);
module.exports = ScheduledDeath;
