const { mongoose } = require("../mongoose");

// will hold game state like channels that were dynamically created during the season, blackout, etc...
// there will only be one of these at a time
const psuedocideSchema = new mongoose.Schema({
    time: { type: Number, required: true },
    target: { type: String, required: true },
    role: { type: String, required: true },
});

const Psuedocide = mongoose.model("pseudocide", psuedocideSchema);
module.exports = Psuedocide;
