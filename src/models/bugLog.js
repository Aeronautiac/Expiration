const { mongoose } = require("../mongoose");

const bugLogSchema = new mongoose.Schema({
    buggedBy: String,
    targetId: { type: String, required: true },
    channelIds: { type: Map, of: String, required: true, default: {} }, // map of channel aliases to channelIds
    source: { type: String, required: true },
});

const BugLog = mongoose.model("bugLog", bugLogSchema);
module.exports = BugLog;
