const util = {};

util.hrsToMs = function (hrs) {
    return hrs * 60 * 60 * 1000;
};

util.minsToMs = function (mins) {
    return mins * 60 * 1000;
};

util.secsToMs = function (secs) {
    return secs * 1000;
};

util.wait = async function (ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

module.exports = util;
