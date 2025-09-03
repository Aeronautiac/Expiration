const { mongoose } = require("../mongoose");

// will hold game state like channels that were dynamically created during the season, blackout, etc...
// there will only be one of these at a time
const seasonSchema = new mongoose.Schema({
    _id: { type: String, default: "season" },
    active: { type: Boolean, required: true, default: true },
    temporaryChannels: { type: [String], required: true },
    groupChats: { type: [{ owner: String, members: [String], channelId: String }], required: true },
    messageLoggedChannels: { type: [String], required: true }, // an array of channel ids of which messages are relayed through abilities like bug and autopsy
    blackout: Boolean,
    day: { type: Number, required: true }, // starts day 1
});

const Season = mongoose.model("season", seasonSchema);
module.exports = Season;
