const { mongoose } = require("../mongoose");

const kidnapLoungeSchema = new mongoose.Schema({
    victimId: { type: String, required: true },
    kidnapperId: Number,
    // kidnappersRevealed: { type: Number, required: true },
    channelIds: { type: [String], required: true },
});

const KidnapLounge = mongoose.model("kidnaplounge", kidnapLoungeSchema);
module.exports = KidnapLounge;
