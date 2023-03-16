const {
    S3Client,
    GetObjectCommand,
    CopyObjectCommand,
    DeleteObjectCommand,
    HeadBucketCommand,
    HeadObjectCommand,
    PutObjectCommand
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

function getObjectSignedUrl(tenantId, filePath) {
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

async function getObjectReadableStream(tenantId, filePath, bytesStart, bytesEnd) {
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

async function getObjectMetadata(tenantId, filePath) {
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
    return s3.send(
        new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET,
            Key: `${tenantId}/${filePath}`,
        })
    );
}

function copyObject(srcTenantId, srcFilePath, dstTenantId, dstFilePath) {
    return s3.send(
        new CopyObjectCommand({
            Bucket: process.env.AWS_BUCKET,
            Key: `${dstTenantId}/${dstFilePath}`,
            CopySource: `/${process.env.AWS_BUCKET}/${srcTenantId}/${srcFilePath}`,
        })
    );
}

async function ensureBucketExists(tenantId) {
    try {
        await s3.send(new HeadBucketCommand({ Bucket: process.env.AWS_BUCKET }));
    } catch (err) {
        if (err.$metadata.httpStatusCode === 404) {
            // await s3.send(new CreateBucketCommand({ Bucket: tenantId }));
        }
    }
}

async function updateObjectMetadata(tenantId, filePath) {
    const file = await s3.send(
        new HeadObjectCommand({
            Bucket: process.env.AWS_BUCKET,
            Key: `${tenantId}/${filePath}`
        })
    );

    return s3.send(
        new CopyObjectCommand({
            Bucket: process.env.AWS_BUCKET,
            Key: `${tenantId}/${filePath}`,
            CopySource: `/${process.env.AWS_BUCKET}/${tenantId}/${filePath}`,
            ContentType: file.ContentType,
			ContentLength: file.ContentLength,
            ContentDisposition: file.ContentDisposition,
            CacheControl: file.CacheControl,
            MetadataDirective: 'REPLACE',
            Metadata: Object.assign(file.Metadata || {}, {
                scanned: "true"
            })
        })
    );
}

function uploadObject({ fileStream, tenantId, filePath, fileName, fileSize, mimeType, ownerId, fileId, metadata }) {
    if (typeof metadata === 'object') {
        for (var p in metadata) {
            metadata[p] = String(metadata[p]);
        }
    }

    return s3.send(
        new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET,
            Key: `${tenantId}/${filePath}`,
            Body: fileStream,
			ContentLength: fileSize,
            ContentType: mimeType || 'application/octet-stream',
            ContentDisposition: `attachment; filename=${fileName}`,
            CacheControl: 'public, max-age=31536000',
            Metadata: Object.assign(metadata || {}, {
                id: fileId,
                name: fileName,
                owner_id: ownerId,
                tenant_id: tenantId,
            })
        })
    );
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
