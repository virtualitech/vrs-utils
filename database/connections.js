const { accessSecretVersion } = require('../secretmanager');

let connectionInfo = null;

async function getConnection() {
    if (!connectionInfo) {
        const connections = await accessSecretVersion('projects/1088752406703/secrets/connections/versions/latest');
        const jsonConn = JSON.parse(connections);
        connectionInfo = jsonConn;
    }

    return connectionInfo;
}

module.exports = (async function () {
    await getConnection();
    return { connectionInfo };
})();
