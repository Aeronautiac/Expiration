const { mongoose } = require('../mongoose');

const loungeSchema = new mongoose.Schema({
    loungeId: { type: Number, required: true },
    channelIds: { type: [String], required: true }, // if there are multiple channel ids, then the bot will relay messages between the channels
});

const Lounge = mongoose.model("lounge", loungeSchema);
module.exports = Lounge;
