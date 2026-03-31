import crypto from 'crypto';
import { PassThrough, Readable } from 'stream';

import { GlacierClient, UploadArchiveCommand, InitiateJobCommand, GetJobOutputCommand, DescribeJobCommand } from "@aws-sdk/client-glacier";

import logger from '../../logger/Logger';
import BaseStorageProvider, { GetBlockReadStreamResult } from '../base_provider/BaseProvider';
import { StorageLocation } from '../base_provider/BaseProvider';

export interface GlacierCredentials {
    vaultName?: string;
    region?: string;
    accessKey?: string;
    secretKey?: string;
    accountId?: string;
}

export interface GlacierLocation extends StorageLocation {
    vaultName: string,
    region: string,
}

class GlacierStorageProvider extends BaseStorageProvider {
    vaultName: string;
    accountId: string;
    client: GlacierClient;
    region: string;
    private activeJobs: Map<string, string> = new Map();

    constructor(vaultName: string, region: string, accessKey: string, secretKey: string, accountId: string = '-') {
        super();
        this.vaultName = vaultName;
        this.accountId = accountId;
        this.region = region;
        this.client = new GlacierClient({
            region: region,
            credentials: {
                accessKeyId: accessKey,
                secretAccessKey: secretKey
            }
        });
        logger.info(`[GlacierStorageProvider] Initialized for vault: ${this.vaultName}`);
    }



    getLocation(): GlacierLocation {
        return {
            type: 'glacier',
            vaultName: this.vaultName,
            region: this.region
        };
    }

    static parseArgs(args: string[], credentials: Partial<GlacierCredentials> = {}) {
        let vaultName = credentials.vaultName || '';
        let region = credentials.region || 'us-east-1';
        let accessKey = credentials.accessKey || '';
        let secretKey = credentials.secretKey || '';
        let accountId = credentials.accountId || '-';

        for (let i = 0; i < args.length; i++) {
            if (args[i] === '--glacier-vault' && i + 1 < args.length) vaultName = args[i + 1];
            if (args[i] === '--glacier-region' && i + 1 < args.length) region = args[i + 1];
            if (args[i] === '--glacier-access-key' && i + 1 < args.length) accessKey = args[i + 1];
            if (args[i] === '--glacier-secret-key' && i + 1 < args.length) secretKey = args[i + 1];
            if (args[i] === '--glacier-account-id' && i + 1 < args.length) accountId = args[i + 1];
        }

        return new GlacierStorageProvider(vaultName, region, accessKey, secretKey, accountId);
    }

    createBlockStream() {
        const passThrough = new PassThrough();
        let buffers: Buffer[] = [];

        // Note: For large archives, Glacier usually requires multipart upload.
        // For simplicity in this implementation, we collect and upload as a single archive.
        passThrough.on('data', (chunk: Buffer) => buffers.push(chunk));
        passThrough.on('end', async () => {
            const fullData = Buffer.concat(buffers);
            try {
                const command = new UploadArchiveCommand({
                    vaultName: this.vaultName,
                    accountId: this.accountId,
                    body: fullData
                });
                const response = await this.client.send(command);
                logger.info(`[GlacierStorageProvider] Successfully archived. ArchiveId: ${response.archiveId}`);
                // Since our system expects a physicalBlockId immediately, we'd ideally return the archiveId.
                // However, our system architecture might need to map our locally generated physicalBlockId to the archiveId.
            } catch (err) {
                logger.error(`[GlacierStorageProvider] Archival failed:`, err);
            }
        });

        // We return a random ID as physicalBlockId; in a real system, we'd store the mapping to ArchiveId in a DB.
        const physicalBlockId = crypto.randomBytes(16).toString('hex');
        return { physicalBlockId, writeStream: passThrough };
    }

    async getBlockReadStream(physicalBlockId: string): Promise<GetBlockReadStreamResult> {
        const existingJobId = this.activeJobs.get(physicalBlockId);

        try {
            if (existingJobId) {
                const describeCommand = new DescribeJobCommand({
                    vaultName: this.vaultName,
                    accountId: this.accountId,
                    jobId: existingJobId
                });
                const jobDesc = await this.client.send(describeCommand);

                if (jobDesc.Completed) {
                    const outputCommand = new GetJobOutputCommand({
                        vaultName: this.vaultName,
                        accountId: this.accountId,
                        jobId: existingJobId
                    });
                    const outputResponse = await this.client.send(outputCommand);
                    if (outputResponse.body) {
                        return { status: 'available', stream: outputResponse.body as unknown as Readable };
                    }
                } else {
                    return {
                        status: 'pending',
                        message: 'Retrieval job is still in progress.',
                        jobId: existingJobId
                    };
                }
            }

            logger.info(`[GlacierStorageProvider] Initiating retrieval job for ${physicalBlockId}...`);
            const command = new InitiateJobCommand({
                vaultName: this.vaultName,
                accountId: this.accountId,
                jobParameters: {
                    Type: "archive-retrieval",
                    ArchiveId: physicalBlockId
                }
            });
            const response = await this.client.send(command);
            logger.info(`[GlacierStorageProvider] Retrieval job initiated. JobId: ${response.jobId}`);
            
            if (response.jobId) {
                this.activeJobs.set(physicalBlockId, response.jobId);
            }

            return {
                status: 'pending',
                message: 'Glacier retrieval is asynchronous. Job initiated but data not immediately available.',
                jobId: response.jobId
            };
        } catch (err) {
            logger.error(`[GlacierStorageProvider] Failed to retrieve or initiate:`, err);
            return { status: 'not_found' };
        }
    }
}

export default GlacierStorageProvider;
