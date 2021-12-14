const { accessSecretVersion } = require('../secretmanager');

let keys = null;

async function init() {
    if (!keys) {
        const map = await accessSecretVersion('projects/1088752406703/secrets/keymap/versions/latest');
        keys = JSON.parse(map);
    }

    return keys;
}

module.exports = { init };
