import { Message } from '../../p2p';
import { MessageOptions } from '../types/Types';

export interface StorageShardTransferOptions {
    marketId: string;
    shardIndex: number;
    shardDataBase64: string;
}

export class StorageShardTransferMessage extends Message {
    constructor(options: MessageOptions<StorageShardTransferOptions> = {}) {
        super(options);
        if (options.marketId !== undefined) this.marketId = options.marketId;
        else if (options.body?.marketId !== undefined) this.marketId = options.body.marketId;

        if (options.shardIndex !== undefined) this.shardIndex = options.shardIndex;
        else if (options.body?.shardIndex !== undefined) this.shardIndex = options.body.shardIndex;

        if (options.shardDataBase64 !== undefined) this.shardDataBase64 = options.shardDataBase64;
        else if (options.body?.shardDataBase64 !== undefined) this.shardDataBase64 = options.body.shardDataBase64;
    }

    get marketId(): string { return this.body.marketId; }
    set marketId(value: string) { this.body = { ...this.body, marketId: value }; }

    get shardIndex(): number { return this.body.shardIndex; }
    set shardIndex(value: number) { this.body = { ...this.body, shardIndex: value }; }

    get shardDataBase64(): string { return this.body.shardDataBase64; }
    set shardDataBase64(value: string) { this.body = { ...this.body, shardDataBase64: value }; }
}
