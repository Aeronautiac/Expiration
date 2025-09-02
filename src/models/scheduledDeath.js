const { mongoose } = require("../mongoose");

const scheduledDeathShema = new mongoose.Schema({
    time: { type: Number, required: true },
    target: { type: String, required: true },
    deathMessage: { type: String },
    writtenBy: { type: String, required: true },
});

const ScheduledDeath = mongoose.model("scheduledDeath", scheduledDeathShema);
module.exports = ScheduledDeath;
