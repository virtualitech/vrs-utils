const isS3 = process.env.FILE_STORAGE_TYPE === 'AWS_S3';

module.exports = isS3 ? require('./aws_s3') : require('./gcs');
