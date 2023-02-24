const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const client = new SecretManagerServiceClient();

module.exports = async function (versionId) {
    const [version] = await client.accessSecretVersion({
        name: versionId,
    });

    return version.payload.data.toString();
};
