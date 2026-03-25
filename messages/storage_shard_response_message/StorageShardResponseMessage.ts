import { Message } from '../../p2p';
import { MessageOptions } from '../types/Types';

export interface StorageShardResponseOptions {
    marketId: string;
    shardIndex: number;
    physicalId: string;
    success: boolean;
}

export class StorageShardResponseMessage extends Message {
    constructor(options: MessageOptions<StorageShardResponseOptions> = {}) {
        super(options);
        if (options.marketId !== undefined) this.marketId = options.marketId;
        else if (options.body?.marketId !== undefined) this.marketId = options.body.marketId;

        if (options.shardIndex !== undefined) this.shardIndex = options.shardIndex;
        else if (options.body?.shardIndex !== undefined) this.shardIndex = options.body.shardIndex;

        if (options.physicalId !== undefined) this.physicalId = options.physicalId;
        else if (options.body?.physicalId !== undefined) this.physicalId = options.body.physicalId;

        if (options.success !== undefined) this.success = options.success;
        else if (options.body?.success !== undefined) this.success = options.body.success;
    }

    get marketId(): string { return this.body.marketId; }
    set marketId(value: string) { this.body = { ...this.body, marketId: value }; }

    get shardIndex(): number { return this.body.shardIndex; }
    set shardIndex(value: number) { this.body = { ...this.body, shardIndex: value }; }

    get physicalId(): string { return this.body.physicalId; }
    set physicalId(value: string) { this.body = { ...this.body, physicalId: value }; }

    get success(): boolean { return this.body.success; }
    set success(value: boolean) { this.body = { ...this.body, success: value }; }
}
