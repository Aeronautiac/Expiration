const { mongoose } = require('../mongoose');

const bugLogSchema = new mongoose.Schema({
    targetId: { type: String, required: true },
    channelId: { type: String, required: true },
    source: { type: String, required: true },
});

const BugLog = mongoose.model("bugLog", bugLogSchema);
module.exports = BugLog;
