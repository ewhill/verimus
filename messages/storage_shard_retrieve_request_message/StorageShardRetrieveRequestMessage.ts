import { Message } from '../../p2p';
import { MessageOptions } from '../types/Types';

export interface StorageShardRetrieveRequestOptions {
    physicalId: string;
    marketId: string;
}

export class StorageShardRetrieveRequestMessage extends Message {
    constructor(options: MessageOptions<StorageShardRetrieveRequestOptions> = {}) {
        super(options);
        if (options.physicalId !== undefined) this.physicalId = options.physicalId;
        else if (options.body?.physicalId !== undefined) this.physicalId = options.body.physicalId;

        if (options.marketId !== undefined) this.marketId = options.marketId;
        else if (options.body?.marketId !== undefined) this.marketId = options.body.marketId;
    }

    get physicalId(): string { return this.body.physicalId; }
    set physicalId(value: string) { this.body = { ...this.body, physicalId: value }; }

    get marketId(): string { return this.body.marketId; }
    set marketId(value: string) { this.body = { ...this.body, marketId: value }; }
}
