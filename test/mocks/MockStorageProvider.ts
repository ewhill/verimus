import { Readable, Writable } from 'stream';

import type { StorageLocation, GetBlockReadStreamResult } from '../../storage_providers/base_provider/BaseProvider';
import BaseStorageProvider from '../../storage_providers/base_provider/BaseProvider';

export class MockStorageProvider extends BaseStorageProvider {
    private _data: any[] = [];
    
    constructor(data: any[] = []) {
        super();
        this._data = data;
    }

    getLocation(): StorageLocation {
        return { type: 'mock' };
    }

    async storeBlock(_unusedEncryptedData: Buffer | string): Promise<string> {
        return 'mock-block-id';
    }

    createBlockStream(): { physicalBlockId: string, writeStream: NodeJS.WritableStream } {
        return {
            physicalBlockId: 'mock-block-stream-id',
            writeStream: new Writable({ write(_unusedChunk, _unusedEncoding, callback) { callback(); } })
        };
    }

    async getBlockReadStream(_unusedPhysicalBlockId: string): Promise<GetBlockReadStreamResult> {
        return { status: 'available', stream: Readable.from(['mock data']) };
    }

    generatePhysicalBlockId(_unusedPhysicalBlockId: string): string {
        return 'mock-generated-id';
    }

    getCostPerGB(): number {
        return 0;
    }

    getEgressCostPerGB(): number {
        return 0;
    }
}
