export interface StorageLocation {
    type: string,
}

export type GetBlockReadStreamResult = 
    | { status: 'available', stream: NodeJS.ReadableStream }
    | { status: 'pending', message: string, jobId?: string }
    | { status: 'not_found' };

/**
 * Base abstract class for storage providers.
 * Each provider must implement its own way of storing and retrieving packages.
 */
class BaseStorageProvider {
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
    static parseArgs(args: string[]): BaseStorageProvider | null {
        throw new Error("parseArgs() must be implemented by subclasses");
    }

    /**
     * Stores the encrypted block and returns a block ID.
     * @param {Buffer|string} encryptedData 
     * @returns {string} physicalBlockId
     */
    async storeBlock(encryptedData: Buffer | string): Promise<string> {
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
    async getBlockReadStream(physicalBlockId: string): Promise<GetBlockReadStreamResult> {
        throw new Error('getBlockReadStream not implemented');
    }

    /**
     * Creates a read stream for the encrypted block given its ID.
     * @param {string} physicalBlockId 
     * @returns {Promise<NodeJS.ReadableStream|object|null>}
     */
    generatePhysicalBlockId(physicalBlockId: string): string {
        throw new Error("generatePhysicalBlockId() must be implemented by subclasses");
    }
}

export default BaseStorageProvider;
