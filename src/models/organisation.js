const { mongoose } = require('../mongoose');

const organisationSchema = new mongoose.Schema({
    organisation: String,
    cooldowns: {
        type: Map,
        of: Number,
        default: {},
        required: true,
    },
});

const Organisation = mongoose.model("organisation", organisationSchema);
module.exports = Organisation;
