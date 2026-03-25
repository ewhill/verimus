import { Message } from '../../p2p';
import { MessageOptions } from '../types/Types';

export interface StorageShardRetrieveResponseOptions {
    physicalId: string;
    shardDataBase64: string;
    marketId: string;
    success: boolean;
}

export class StorageShardRetrieveResponseMessage extends Message {
    constructor(options: MessageOptions<StorageShardRetrieveResponseOptions> = {}) {
        super(options);
        if (options.physicalId !== undefined) this.physicalId = options.physicalId;
        else if (options.body?.physicalId !== undefined) this.physicalId = options.body.physicalId;

        if (options.shardDataBase64 !== undefined) this.shardDataBase64 = options.shardDataBase64;
        else if (options.body?.shardDataBase64 !== undefined) this.shardDataBase64 = options.body.shardDataBase64;
        
        if (options.marketId !== undefined) this.marketId = options.marketId;
        else if (options.body?.marketId !== undefined) this.marketId = options.body.marketId;

        if (options.success !== undefined) this.success = options.success;
        else if (options.body?.success !== undefined) this.success = options.body.success;
    }

    get physicalId(): string { return this.body.physicalId; }
    set physicalId(value: string) { this.body = { ...this.body, physicalId: value }; }

    get shardDataBase64(): string { return this.body.shardDataBase64; }
    set shardDataBase64(value: string) { this.body = { ...this.body, shardDataBase64: value }; }

    get marketId(): string { return this.body.marketId; }
    set marketId(value: string) { this.body = { ...this.body, marketId: value }; }

    get success(): boolean { return this.body.success; }
    set success(value: boolean) { this.body = { ...this.body, success: value }; }
}
