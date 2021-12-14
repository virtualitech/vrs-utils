const secretManager = require('../secretmanager');
let keys = null;

module.exports = async function () {
    if (!keys) {
        const map = await secretManager('projects/1088752406703/secrets/keymap/versions/latest');
        keys = JSON.parse(map);
    }

    return keys;
};
