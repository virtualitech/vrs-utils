const secretManager = require('../secretmanager');
const secretPath = process.env.DB_SECRET_MANAGER_RESOURCE_ID || 'projects/1088752406703/secrets/connections/versions/latest';
let connectionInfo = null;

module.exports = async function () {
    if (!connectionInfo) {
        const connections = await secretManager(secretPath);
        connectionInfo = JSON.parse(connections);
    }

    return connectionInfo;
};
