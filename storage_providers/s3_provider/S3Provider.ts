import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import BaseStorageProvider, { GetBlockReadStreamResult } from '../base_provider/BaseProvider';
import { PassThrough } from 'stream';
import logger from '../../logger/Logger';
import crypto from 'crypto';

export interface S3Credentials {
    bucket?: string;
    region?: string;
    accessKey?: string;
    secretKey?: string;
}

class S3StorageProvider extends BaseStorageProvider {
    bucket: string;
    region: string;
    client: S3Client;

    constructor(bucket: string, region: string, accessKey: string, secretKey: string) {
        super();
        this.bucket = bucket;
        this.region = region;
        this.client = new S3Client({
            region: region,
            credentials: {
                accessKeyId: accessKey,
                secretAccessKey: secretKey
            }
        });
        logger.info(`[S3StorageProvider] Initialized for bucket: ${this.bucket}`);
    }

    getLocation() {
        return {
            type: 's3',
            bucket: this.bucket,
            region: this.region
        };
    }

    static parseArgs(args: string[], credentials: Partial<S3Credentials> = {}) {
        let bucket = credentials.bucket || '';
        let region = credentials.region || 'us-east-1';
        let accessKey = credentials.accessKey || '';
        let secretKey = credentials.secretKey || '';

        for (let i = 0; i < args.length; i++) {
            if (args[i] === '--s3-bucket' && i + 1 < args.length) bucket = args[i + 1];
            if (args[i] === '--s3-region' && i + 1 < args.length) region = args[i + 1];
            if (args[i] === '--s3-access-key' && i + 1 < args.length) accessKey = args[i + 1];
            if (args[i] === '--s3-secret-key' && i + 1 < args.length) secretKey = args[i + 1];
        }

        return new S3StorageProvider(bucket, region, accessKey, secretKey);
    }

    createBlockStream() {
        const physicalBlockId = crypto.randomBytes(16).toString('hex');
        const passThrough = new PassThrough();

        const upload = new Upload({
            client: this.client,
            params: {
                Bucket: this.bucket,
                Key: `${physicalBlockId}.pkg`,
                Body: passThrough
            }
        });

        // Run upload in background, log errors
        upload.done().catch((err: Error | NodeJS.ErrnoException | object) => {
            logger.error(`[S3StorageProvider] Upload failed for ${physicalBlockId}:`, err);
        });

        return { physicalBlockId, writeStream: passThrough };
    }

    async getBlockReadStream(physicalBlockId: string): Promise<GetBlockReadStreamResult> {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: `${physicalBlockId}.pkg`
            });
            const response = await this.client.send(command);
            return { status: 'available', stream: response.Body as unknown as NodeJS.ReadableStream }; // This is a readable stream in Node.js SDK v3
        } catch (err: any) {
            logger.error(`[S3StorageProvider] Failed to get read stream for ${physicalBlockId}:`, err);
            return { status: 'not_found' };
        }
    }
}

export default S3StorageProvider;
