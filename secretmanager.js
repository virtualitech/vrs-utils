const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
// Instantiates a client
const client = new SecretManagerServiceClient();

async function accessSecretVersion(versionId) {
    const [version] = await client.accessSecretVersion({
        name: versionId,
    });

    return version.payload.data.toString();
}

module.exports = { accessSecretVersion };
