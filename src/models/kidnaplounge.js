const { mongoose } = require('../mongoose');

const kidnapLoungeSchema = new mongoose.Schema({
    victimId: { type: Number, required: true },
    kidnapperId: Number,
    // kidnappersRevealed: { type: Number, required: true },
    channelIds: { type: [String], required: true },
});

const KidnapLounge = mongoose.model("kidnaplounge", kidnapLoungeSchema);
module.exports = KidnapLounge;