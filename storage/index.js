const {
    S3Client,
    GetObjectCommand,
    CopyObjectCommand,
    DeleteObjectCommand,
    HeadBucketCommand,
    HeadObjectCommand,
} = require('@aws-sdk/client-s3');

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { NodeHttpHandler } = require('@aws-sdk/node-http-handler');

const s3 = new S3Client({
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    region: process.env.AWS_REGION,
    endpoint: `https://${process.env.AWS_ENDPOINT}`,
    signatureVersion: 'v4',
    forcePathStyle: true, // this is required to work with bulutistan s3
    requestHandler: new NodeHttpHandler({
        connectionTimeout: 1000,
        socketTimeout: 10000,
    }),
});

const { Storage: GCS } = require('@google-cloud/storage');
const gcs = new GCS();

const isS3 = process.env.FILE_STORAGE_TYPE === 'AWS_S3';

function getSignedUrl_S3(tenantId, filePath) {
    return getSignedUrl(
        s3,
        new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET,
            Key: `${tenantId}/${filePath}`,
        }),
        {
            expiresIn: 1800,
        }
    );
}

async function getReadableStream_S3(tenantId, filePath, bytesStart, bytesEnd) {
    let file;

    if (typeof bytesStart === 'number' && typeof bytesEnd === 'number') {
        file = await s3.send(
            new GetObjectCommand({
                Bucket: process.env.AWS_BUCKET,
                Key: `${tenantId}/${filePath}`,
                Range: `bytes=${bytesStart}-${bytesEnd}`,
            })
        );
    } else {
        file = await s3.send(
            new GetObjectCommand({
                Bucket: process.env.AWS_BUCKET,
                Key: `${tenantId}/${filePath}`,
            })
        );
    }

    return file.Body;
}

async function getMetadata_S3(tenantId, filePath) {
    const file = await s3.send(
        new HeadObjectCommand({
            Bucket: process.env.AWS_BUCKET,
            Key: `${tenantId}/${filePath}`,
        })
    );

    return {
        contentType: file.ContentType,
        contentDisposition: file.ContentDisposition,
        size: file.ContentLength,
        metadata: file.Metadata,
    };
}

async function getSize_S3(tenantId, filePath) {
    try {
        const { size } = await getMetadata_S3(tenantId, filePath);
        return size;
    } catch (err) {
        // file not found
        return 0;
    }
}

function delete_S3(tenantId, filePath) {
    return s3.send(
        new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET,
            Key: `${tenantId}/${filePath}`,
        })
    );
}

function copy_S3(srcBucket, srcPath, dstBucket, dstPath) {
    return s3.send(
        new CopyObjectCommand({
            Bucket: process.env.AWS_BUCKET,
            Key: `${dstBucket}/${dstPath}`,
            CopySource: `/${srcBucket}/${srcPath}`,
        })
    );
}

async function ensureTenantBucketExists_S3(tenantId) {
    try {
        await s3.send(new HeadBucketCommand({ Bucket: tenantId }));
    } catch (err) {
        if (err.$metadata.httpStatusCode === 404) {
            // await s3.send(new CreateBucketCommand({ Bucket: tenantId }));
        }
    }
}

async function getSignedUrl_GCS(tenantId, filePath) {
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

function getReadableStream_GCS(tenantId, filePath, bytesStart, bytesEnd) {
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

async function getMetadata_GCS(tenantId, filePath) {
    const [fileMetadata] = await gcs.bucket(tenantId).file(filePath).getMetadata();

    return {
        contentType: fileMetadata.contentType,
        contentDisposition: fileMetadata.contentDisposition,
        size: fileMetadata.size,
        metadata: fileMetadata.metadata,
    };
}

async function getSize_GCS(tenantId, filePath) {
    try {
        const { size } = await getMetadata_GCS(tenantId, filePath);
        return size;
    } catch (err) {
        // file not found
        return 0;
    }
}

function delete_GCS(tenantId, filePath) {
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

function copy_GCS(srcBucket, srcPath, dstBucket, dstPath) {
    const oldFile = gcs.bucket(srcBucket).file(srcPath);
    const newFile = gcs.bucket(dstBucket).file(dstPath);
    return oldFile.copy(newFile);
}

async function ensureTenantBucketExists_GCS(tenantId) {
    const [exists] = await gcs.bucket(tenantId).exists();

    if (!exists) {
        await gcs.createBucket(tenantId, {
            multiRegional: true,
            location: 'eu',
        });
    }
}

module.exports = {
    getSignedUrl: isS3 ? getSignedUrl_S3 : getSignedUrl_GCS,
    getReadableStream: isS3 ? getReadableStream_S3 : getReadableStream_GCS,
    getMetadata: isS3 ? getMetadata_S3 : getMetadata_GCS,
    getSize: isS3 ? getSize_S3 : getSize_GCS,
    delete: isS3 ? delete_S3 : delete_GCS,
    copy: isS3 ? copy_S3 : copy_GCS,
    ensureTenantBucketExists: isS3 ? ensureTenantBucketExists_S3 : ensureTenantBucketExists_GCS,
};
