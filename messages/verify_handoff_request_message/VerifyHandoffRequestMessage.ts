import { Message } from '../../p2p';
import { MessageOptions } from '../types/Types';

export interface VerifyHandoffRequestOptions {
    marketId: string;
    physicalId: string;
    targetChunkIndex: number;
}

export class VerifyHandoffRequestMessage extends Message {
    constructor(options: MessageOptions<VerifyHandoffRequestOptions> = {}) {
        super(options);
        if (options.marketId !== undefined) this.marketId = options.marketId;
        else if (options.body?.marketId !== undefined) this.marketId = options.body.marketId;

        if (options.physicalId !== undefined) this.physicalId = options.physicalId;
        else if (options.body?.physicalId !== undefined) this.physicalId = options.body.physicalId;

        if (options.targetChunkIndex !== undefined) this.targetChunkIndex = options.targetChunkIndex;
        else if (options.body?.targetChunkIndex !== undefined) this.targetChunkIndex = options.body.targetChunkIndex;
    }

    get marketId(): string { return this.body.marketId; }
    set marketId(value: string) { this.body = { ...this.body, marketId: value }; }

    get physicalId(): string { return this.body.physicalId; }
    set physicalId(value: string) { this.body = { ...this.body, physicalId: value }; }

    get targetChunkIndex(): number { return this.body.targetChunkIndex; }
    set targetChunkIndex(value: number) { this.body = { ...this.body, targetChunkIndex: value }; }
}
