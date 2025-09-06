const { mongoose } = require("../mongoose");

const playerSchema = new mongoose.Schema({
    // stuff that every player has
    userId: { type: String, required: true, unique: true },
    trueName: { type: String, required: true, unique: true },
    role: { type: String, required: true },
    alive: { type: Boolean, required: true },
    loungeChannelIds: { type: [String], required: true, default: [] }, // stores lounge ids
    contactTokens: { type: Number, required: true  },
    // monologueChannelId: { type: String, required: true },
    monologueChannelId: String,
    cooldowns: {
        type: Map,
        of: Number,
        default: {},
        required: true,
    },
    kills: { type: Number, required: true, default: 0 },
    loungeHideReasons: { type: [String], required: true, default: [] },
    affiliations: { type: [String], required: true, default: [] },
    notebookRestrictReasons: { type: [String], required: true, default: [] },

    // role ability system
    // abilitiesUsedToday: { type: [String], required: true, default: [] },
    // abilityCharges: { type: Map, of: Number, default: {}, required: true },

    // for autopsy
    timeOfDeath: Number,

    // other systems
    ipp: Boolean,
    custody: Boolean,

    // kira and 2nd kira
    unlocked: Boolean,
    underTheRadar: Boolean,
    underTheRadarCharges: Number,

    // BB
    pseudocideCharges: Number,
    pseudocideUsedToday: Boolean,
    eyes: { type: Number, required: true, default: 2 },

    // PI
    ippCharges: Number,
    ippUsedToday: Boolean,

    // server management stuff
    invites: { type: Map, of: String, required: true, default: {} },
});

const Player = mongoose.model("player", playerSchema);
module.exports = Player;
