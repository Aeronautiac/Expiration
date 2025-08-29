const { mongoose } = require("../mongoose");

const playerSchema = new mongoose.Schema({
    // stuff that every player has
    userId: { type: String, required: true, unique: true },
    trueName: { type: String, required: true, unique: true },
    role: { type: String, required: true },
    alive: { type: Boolean, required: true },
    loungeChannelIds: { type: [String], required: true }, // stores lounge ids
    contactTokens: { type: Number, required: true },
    monologueChannelId: String,
    cooldowns: {
        type: Map,
        of: Number,
        default: {},
        required: true,
    },
    kills: { type: Number, required: true },
    loungeHideReasons: { type: [String], required: true },
    affiliations: { type: [String], required: true },
    notebookRestrictReasons: { type: [String], required: true },

    // death protection
    ipp: Boolean,

    // kira and 2nd kira
    unlocked: Boolean,
    underTheRadar: Boolean,
    underTheRadarCharges: Number,

    // BB
    pseudocideCharges: Number,
    pseudocideUsedToday: Boolean,

    // PI
    ippCharges: Number,
    ippUsedToday: Boolean,
});

const Player = mongoose.model("player", playerSchema);
module.exports = Player;
