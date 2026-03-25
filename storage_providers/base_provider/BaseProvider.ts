export interface StorageLocation {
    type: string,
}

import { Readable } from 'stream';

export type GetBlockReadStreamResult = 
    | { status: 'available', stream: Readable }
    | { status: 'pending', message: string, jobId?: string }
    | { status: 'not_found' };

/**
 * Base abstract class for storage providers.
 * Each provider must implement its own way of storing and retrieving packages.
 */
abstract class BaseStorageProvider {
    /**
     * Returns non-sensitive connection details for the storage provider.
     * @returns {Object} location metadata
     */
    getLocation(): StorageLocation {
        throw new Error('getLocation not implemented');
    }

    /**
     * Parse CLI arguments and return an instance of the provider.
     * @param {string[]} args - CLI arguments (process.argv).
     * @returns {BaseStorageProvider|null}
     */
    static parseArgs(_unusedArgs: string[]): BaseStorageProvider | null {
        throw new Error("parseArgs() must be implemented by subclasses");
    }

    /**
     * Stores the encrypted block and returns a block ID.
     * @param {Buffer|string} encryptedData 
     * @returns {string} physicalBlockId
     */
    async storeBlock(_unusedEncryptedData: Buffer | string): Promise<string> {
        throw new Error("storeBlock() must be implemented by subclasses");
    }

    /**
     * Creates a write stream for the encrypted block.
     * @returns {{ physicalBlockId: string, writeStream: NodeJS.WritableStream }}
     */
    createBlockStream(): { physicalBlockId: string, writeStream: NodeJS.WritableStream } {
        throw new Error('createBlockStream not implemented');
    }

    /**
     * Creates a read stream for the encrypted block given its ID.
     * @param {string} physicalBlockId 
     * @returns {Promise<GetBlockReadStreamResult>}
     */
    async getBlockReadStream(_unusedPhysicalBlockId: string): Promise<GetBlockReadStreamResult> {
        throw new Error('getBlockReadStream not implemented');
    }

    /**
     * Creates a read stream for the encrypted block given its ID.
     * @param {string} physicalBlockId 
     * @returns {Promise<NodeJS.ReadableStream|object|null>}
     */
    generatePhysicalBlockId(_unusedPhysicalBlockId: string): string {
        throw new Error("generatePhysicalBlockId() must be implemented by subclasses");
    }

    /**
     * Determines the cost per Gigabyte for a 30-day billing cycle.
     * @returns Float denoting the VERI token cost.
     */
    abstract getCostPerGB(): number;

    /**
     * Determines the cost per Gigabyte transferred via the REST egress streaming HTTP pipe.
     * @returns Float denoting VERI token deduction mapping byte iterations uniformly.
     */
    abstract getEgressCostPerGB(): number;
}

export default BaseStorageProvider;
