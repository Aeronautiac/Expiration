const { mongoose } = require("../mongoose");

const delayedActionSchema = new mongoose.Schema({
    // universal
    timeBegan: { type: Number, required: true },
    delay: { type: Number, required: true },
    actionName: { type: String, required: true },

    arguments: { type: [mongoose.Schema.Types.Mixed] }
});

const DelayedAction = mongoose.model("delayedAction", delayedActionSchema);
module.exports = DelayedAction;
    