const { Storage: GCS } = require('@google-cloud/storage');
const gcs = new GCS();

async function getObjectSignedUrl(tenantId, filePath) {
    const [fileUrl] = await gcs
        .bucket(tenantId)
        .file(filePath)
        .getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 30 * 60 * 1000, // 30 minutes
        });

    return fileUrl;
}

function getObjectReadableStream(tenantId, filePath, bytesStart, bytesEnd) {
    const file = gcs.bucket(tenantId).file(filePath);

    if (typeof bytesStart === 'number' && typeof bytesEnd === 'number') {
        return file.createReadStream({
            validation: false,
            start: bytesStart,
            end: bytesEnd,
        });
    }

    return file.createReadStream({ validation: false });
}

async function getObjectMetadata(tenantId, filePath) {
    const [fileMetadata] = await gcs.bucket(tenantId).file(filePath).getMetadata();

    return {
        contentType: fileMetadata.contentType,
        contentDisposition: fileMetadata.contentDisposition,
        size: fileMetadata.size,
        metadata: fileMetadata.metadata,
    };
}

async function getObjectSize(tenantId, filePath) {
    try {
        const { size } = await getMetadata(tenantId, filePath);
        return size;
    } catch (err) {
        // file not found
        return 0;
    }
}

function deleteObject(tenantId, filePath) {
    return new Promise((resolve, reject) => {
        gcs.bucket(tenantId)
            .file(filePath)
            .delete()
            .then(() => {
                resolve(true);
            })
            .catch((err) => {
                if (+err.code === 404) {
                    resolve(true);
                } else {
                    reject(err);
                }
            });
    });
}

function copyObject(srcTenantId, srcFilePath, dstTenantId, dstFilePath) {
    const oldFile = gcs.bucket(srcTenantId).file(srcFilePath);
    const newFile = gcs.bucket(dstTenantId).file(dstFilePath);
    return oldFile.copy(newFile);
}

async function ensureBucketExists(tenantId) {
    const [exists] = await gcs.bucket(tenantId).exists();

    if (!exists) {
        await gcs.createBucket(tenantId, {
            multiRegional: true,
            location: 'eu',
        });
    }
}

async function updateObjectMetadata(tenantId, filePath) {
    const file = gcs.bucket(tenantId).file(filePath);
    return file.setMetadata({
        metadata: {
            scanned: "true"
        }
    });
}

function uploadObject({ fileStream, tenantId, filePath, fileName, mimeType, ownerId, fileId, metadata }) {
    return new Promise((resolve, reject) => {
        const bucket = gcs.bucket(tenantId);
        const bucketFile = bucket.file(filePath);

        const bucketWriteStream = bucketFile.createWriteStream({
            resumable: false,
            gzip: true,
            metadata: {
                contentType: mimeType || 'application/octet-stream',
                contentDisposition: `attachment; filename=${fileName}`,
                cacheControl: 'public, max-age=31536000',
                metadata: Object.assign(metadata || {}, {
                    id: fileId,
                    name: fileName,
                    owner_id: ownerId,
                    tenant_id: tenantId,
                })
            }
        });

        bucketWriteStream
            .on('error', (err) => {
                reject(err);
            })
            .on('finish', async () => {
                resolve();
            });

        fileStream.pipe(bucketWriteStream, { end: true });
    });
}

module.exports = {
    getSignedUrl: getObjectSignedUrl,
    getReadableStream: getObjectReadableStream,
    getMetadata: getObjectMetadata,
    getSize: getObjectSize,
    delete: deleteObject,
    copy: copyObject,
    ensureBucketExists: ensureBucketExists,
    updateMetadata: updateObjectMetadata,
    upload: uploadObject
};