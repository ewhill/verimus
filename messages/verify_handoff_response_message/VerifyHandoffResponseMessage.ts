import { Message } from '../../p2p';
import { MessageOptions } from '../types/Types';

export interface VerifyHandoffResponseOptions {
    marketId: string;
    physicalId: string;
    targetChunkIndex: number;
    chunkDataBase64: string; 
    merkleSiblings: string[];
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

        if (options.chunkDataBase64 !== undefined) this.chunkDataBase64 = options.chunkDataBase64;
        else if (options.body?.chunkDataBase64 !== undefined) this.chunkDataBase64 = options.body.chunkDataBase64;

        if (options.merkleSiblings !== undefined) this.merkleSiblings = options.merkleSiblings;
        else if (options.body?.merkleSiblings !== undefined) this.merkleSiblings = options.body.merkleSiblings;

        if (options.success !== undefined) this.success = options.success;
        else if (options.body?.success !== undefined) this.success = options.body.success;
    }

    get marketId(): string { return this.body.marketId; }
    set marketId(value: string) { this.body = { ...this.body, marketId: value }; }

    get physicalId(): string { return this.body.physicalId; }
    set physicalId(value: string) { this.body = { ...this.body, physicalId: value }; }

    get targetChunkIndex(): number { return this.body.targetChunkIndex; }
    set targetChunkIndex(value: number) { this.body = { ...this.body, targetChunkIndex: value }; }

    get chunkDataBase64(): string { return this.body.chunkDataBase64; }
    set chunkDataBase64(value: string) { this.body = { ...this.body, chunkDataBase64: value }; }

    get merkleSiblings(): string[] { return this.body.merkleSiblings || []; }
    set merkleSiblings(value: string[]) { this.body = { ...this.body, merkleSiblings: value }; }

    get success(): boolean { return this.body.success; }
    set success(value: boolean) { this.body = { ...this.body, success: value }; }
}
