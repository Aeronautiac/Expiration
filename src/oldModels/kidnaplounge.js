const { mongoose } = require("../mongoose");

const kidnapLoungeSchema = new mongoose.Schema({
    victimId: { type: String, required: true },
    kidnapperId: String,
    kidnapperChannelId: { type: String, required: true },
    kidnappedChannelId: { type: String, required: true },
    channelIds: { type: [String], required: true },
    actionId: mongoose.Schema.Types.ObjectId,
});

const KidnapLounge = mongoose.model("kidnaplounge", kidnapLoungeSchema);
module.exports = KidnapLounge;
