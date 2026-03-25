import { PassThrough } from 'stream';

import { hashData } from '../../crypto_utils/CryptoUtils';
import logger from '../../logger/Logger';
import BaseStorageProvider, { GetBlockReadStreamResult } from '../base_provider/BaseProvider';
class MemoryStorageProvider extends BaseStorageProvider {
    // In-memory persistent map mimicking physical storage bound by physicalBlockId
    storage: Map<string, Buffer>;

    constructor() {
        super();
        this.storage = new Map<string, Buffer>();
    }

    getCostPerGB(): number { return 0.0; }
    getEgressCostPerGB(): number { return 0.0; }

    getLocation() {
        return {
            type: 'memory',
            info: 'Ephemeral volatile memory mapping'
        };
    }

    static parseArgs(_unusedArgs: string[], _unusedCredentials: Record<string, unknown> = {}) {
        logger.info(`[MemoryStorageProvider] Initialized`);
        return new MemoryStorageProvider();
    }

    async storeBlock(encryptedData: Buffer | string): Promise<string> {
        const physicalBlockId = hashData(Date.now().toString() + Math.random().toString());
        const content = Buffer.isBuffer(encryptedData) ? encryptedData : Buffer.from(encryptedData);
        
        this.storage.set(physicalBlockId, content);
        return physicalBlockId;
    }

    createBlockStream() {
        const physicalBlockId = hashData(Date.now().toString() + Math.random().toString());
        const pt = new PassThrough();
        const bufs: Buffer[] = [];
        
        pt.on('data', (chunk: Buffer) => bufs.push(chunk));
        pt.on('end', () => {
            const compiledBlock = Buffer.concat(bufs);
            this.storage.set(physicalBlockId, compiledBlock);
            logger.info(`[MemoryStorageProvider] Block ${physicalBlockId} flushed into mapped memory`);
        });

        // Simulating physical file stream limits
        return { physicalBlockId, writeStream: pt };
    }

    async getBlockReadStream(physicalBlockId: string): Promise<GetBlockReadStreamResult> {
        if (!this.storage.has(physicalBlockId)) {
            return { status: 'not_found' }; // Return mimicking unreadable mapped files
        }

        const data = this.storage.get(physicalBlockId);
        const pt = new PassThrough();
        pt.end(data);
        return { status: 'available', stream: pt };
    }

    generatePhysicalBlockId(physicalBlockId: string): string {
        return `mem-${physicalBlockId}`;
    }
}

export default MemoryStorageProvider;
