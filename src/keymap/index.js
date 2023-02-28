const secretManager = require('../secretmanager');
const secretPath = process.env.KEYMAP_SECRET_MANAGER_RESOURCE_ID || 'projects/1088752406703/secrets/keymap/versions/latest';
let keys = null;

module.exports = async function () {
    if (!keys) {
        const map = await secretManager(secretPath);
        keys = JSON.parse(map);
    }

    return keys;
};
