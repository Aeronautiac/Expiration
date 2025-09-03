const { mongoose } = require("../mongoose");

const organisationSchema = new mongoose.Schema({
    organisation: { type: String, required: true },
    cooldowns: {
        type: Map,
        of: Number,
        default: {},
        required: true,
    },
    leader: String,
});

const Organisation = mongoose.model("organisation", organisationSchema);
module.exports = Organisation;
