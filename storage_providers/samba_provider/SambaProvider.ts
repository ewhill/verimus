import crypto from 'crypto';
import { PassThrough } from 'stream';

import SMB2 from 'smb2';

import logger from '../../logger/Logger';
import BaseStorageProvider, { GetBlockReadStreamResult } from '../base_provider/BaseProvider';


export interface SambaCredentials {
    share?: string;
    username?: string;
    password?: string;
    domain?: string;
}

class SambaStorageProvider extends BaseStorageProvider {
    smbClient: any;

    constructor(share: string, username: string, password: string, domain: string = '') {
        super();
        this.smbClient = new SMB2({
            share: share,
            domain: domain,
            username: username,
            password: password
        });
        logger.info(`[SambaStorageProvider] Initialized for share: ${share}`);
    }



    getLocation() {
        return {
            type: 'samba',
            share: this.smbClient.share
        };
    }

    static parseArgs(args: string[], credentials: Partial<SambaCredentials> = {}) {
        let share = credentials.share || '';
        let username = credentials.username || '';
        let password = credentials.password || '';
        let domain = credentials.domain || '';

        for (let i = 0; i < args.length; i++) {
            if (args[i] === '--samba-share' && i + 1 < args.length) share = args[i + 1];
            if (args[i] === '--samba-user' && i + 1 < args.length) username = args[i + 1];
            if (args[i] === '--samba-pass' && i + 1 < args.length) password = args[i + 1];
            if (args[i] === '--samba-domain' && i + 1 < args.length) domain = args[i + 1];
        }

        return new SambaStorageProvider(share, username, password, domain);
    }

    createBlockStream() {
        const physicalBlockId = crypto.randomBytes(16).toString('hex');
        const passThrough = new PassThrough();
        const fileName = `${physicalBlockId}.pkg`;

        // SMB2 does not support native Node.js streams easily for writing in a single call,
        // so we collect buffers and write them. For a more robust implementation,
        // we'd chunk them.
        let buffers: Buffer[] = [];
        passThrough.on('data', (chunk: Buffer) => buffers.push(chunk));
        passThrough.on('end', () => {
            const fullBuffer = Buffer.concat(buffers);
            this.smbClient.writeFile(fileName, fullBuffer, (err: Error | null) => {
                if (err) logger.error(`[SambaStorageProvider] Failed to write ${fileName}:`, err);
                else logger.info(`[SambaStorageProvider] Successfully wrote ${fileName}`);
            });
        });

        return { physicalBlockId, writeStream: passThrough };
    }

    async getBlockReadStream(physicalBlockId: string): Promise<GetBlockReadStreamResult> {
        const fileName = `${physicalBlockId}.pkg`;
        const passThrough = new PassThrough();

        return new Promise<GetBlockReadStreamResult>((resolve) => {
            this.smbClient.readFile(fileName, (err: Error | null, data: Buffer) => {
                if (err) {
                    logger.error(`[SambaStorageProvider] Failed to read ${fileName}:`, err);
                    resolve({ status: 'not_found' });
                } else {
                    passThrough.end(data);
                    resolve({ status: 'available', stream: passThrough });
                }
            });
        });
    }
}

export default SambaStorageProvider;
