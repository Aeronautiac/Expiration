// note that notebook channel data is cleared on season reset!!

const { mongoose } = require("../mongoose");

const notebookSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    originalOwner: { type: String, required: true },
    currentOwner: { type: String, required: true },
    temporaryOwner: { type: String },
    usedToday: { type: [String], required: true }, // an array of user ids who have killed someone using this notebook today. reset when the day ends.
    attemptsToday: { type: Map, of: Number, default: {}, required: true }, // the number of times somebody has tried and failed to use the notebook today. resets on day end.
});

const Notebook = mongoose.model("notebook", notebookSchema);
module.exports = Notebook;
