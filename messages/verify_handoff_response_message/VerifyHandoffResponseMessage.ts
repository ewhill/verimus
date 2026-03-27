import { Message } from '../../p2p';
import { MessageOptions } from '../types/Types';

export interface VerifyHandoffResponseOptions {
    marketId: string;
    physicalId: string;
    targetChunkIndex: number;
    chunkHashBase64: string; 
    success: boolean;
}

export class VerifyHandoffResponseMessage extends Message {
    constructor(options: MessageOptions<VerifyHandoffResponseOptions> = {}) {
        super(options);
        
        if (options.marketId !== undefined) this.marketId = options.marketId;
        else if (options.body?.marketId !== undefined) this.marketId = options.body.marketId;

        if (options.physicalId !== undefined) this.physicalId = options.physicalId;
        else if (options.body?.physicalId !== undefined) this.physicalId = options.body.physicalId;

        if (options.targetChunkIndex !== undefined) this.targetChunkIndex = options.targetChunkIndex;
        else if (options.body?.targetChunkIndex !== undefined) this.targetChunkIndex = options.body.targetChunkIndex;

        if (options.chunkHashBase64 !== undefined) this.chunkHashBase64 = options.chunkHashBase64;
        else if (options.body?.chunkHashBase64 !== undefined) this.chunkHashBase64 = options.body.chunkHashBase64;

        if (options.success !== undefined) this.success = options.success;
        else if (options.body?.success !== undefined) this.success = options.body.success;
    }

    get marketId(): string { return this.body.marketId; }
    set marketId(value: string) { this.body = { ...this.body, marketId: value }; }

    get physicalId(): string { return this.body.physicalId; }
    set physicalId(value: string) { this.body = { ...this.body, physicalId: value }; }

    get targetChunkIndex(): number { return this.body.targetChunkIndex; }
    set targetChunkIndex(value: number) { this.body = { ...this.body, targetChunkIndex: value }; }

    get chunkHashBase64(): string { return this.body.chunkHashBase64; }
    set chunkHashBase64(value: string) { this.body = { ...this.body, chunkHashBase64: value }; }

    get success(): boolean { return this.body.success; }
    set success(value: boolean) { this.body = { ...this.body, success: value }; }
}
