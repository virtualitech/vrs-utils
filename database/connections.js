const secretManager = require('../secretmanager');
let connectionInfo = null;

module.exports = async function () {
    if (!connectionInfo) {
        const connections = await secretManager('projects/1088752406703/secrets/connections/versions/latest');
        connectionInfo = JSON.parse(connections);
    }

    return connectionInfo;
};
