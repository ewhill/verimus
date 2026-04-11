import fs from 'fs';
import path from 'path';

import { hashData } from '../../crypto_utils/CryptoUtils';
import logger from '../../logger/Logger';
import BaseStorageProvider, { GetBlockReadStreamResult } from '../base_provider/BaseProvider';

export interface LocalCredentials {
    storageDir?: string;
}

class LocalFileStorageProvider extends BaseStorageProvider {
    storageDir: string;

    constructor(storageDir: string = './storage') {
        super();
        this.storageDir = storageDir;
        if (!fs.existsSync(this.storageDir)) {
            fs.mkdirSync(this.storageDir, { recursive: true });
        }
    }



    private assertValidBlockId(physicalBlockId: string) {
        if (!/^[a-zA-Z0-9_-]+$/.test(physicalBlockId)) {
            throw new Error(`Invalid physicalBlockId format correctly blocked path traversal attempt.`);
        }
    }

    getLocation() {
        return {
            type: 'local',
            storageDir: path.resolve(this.storageDir)
        };
    }

    static parseArgs(args: string[], credentials: Partial<LocalCredentials> = {}) {
        let storageDir = credentials.storageDir || './storage';
        for (let i = 0; i < args.length; i++) {
            if (args[i] === '--storage-dir' && i + 1 < args.length) {
                storageDir = args[i + 1];
                break;
            }
        }
        logger.info(`[LocalFileStorageProvider] Using directory: ${storageDir}`);
        return new LocalFileStorageProvider(storageDir);
    }

    async storeShard(physicalBlockId: string, encryptedData: Buffer | string): Promise<void> {
        this.assertValidBlockId(physicalBlockId);
        const filePath = path.join(this.storageDir, `${physicalBlockId}.pkg`);
        fs.writeFileSync(filePath, encryptedData);
    }

    createBlockStream() {
        const physicalBlockId = hashData(Date.now().toString() + Math.random().toString());
        const filePath = path.join(this.storageDir, `${physicalBlockId}.pkg`);
        return { physicalBlockId, writeStream: fs.createWriteStream(filePath) };
    }

    async getBlockReadStream(physicalBlockId: string): Promise<GetBlockReadStreamResult> {
        this.assertValidBlockId(physicalBlockId);
        const filePath = path.join(this.storageDir, `${physicalBlockId}.pkg`);
        if (!fs.existsSync(filePath)) return { status: 'not_found' };
        return { status: 'available', stream: fs.createReadStream(filePath) };
    }
}

export default LocalFileStorageProvider;
