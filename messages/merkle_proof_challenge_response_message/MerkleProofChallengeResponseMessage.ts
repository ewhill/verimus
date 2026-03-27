import { Message } from '../../p2p';
import { MessageOptions } from '../types/Types';

export interface MerkleProofChallengeResponseOptions {
    contractId: string;
    chunkDataBase64: string; 
    merkleSiblings: string[];
    computedRootMatch: boolean;
}

export class MerkleProofChallengeResponseMessage extends Message {
    constructor(options: MessageOptions<MerkleProofChallengeResponseOptions> = {}) {
        super(options);
        
        if (options.contractId !== undefined) this.contractId = options.contractId;
        else if (options.body?.contractId !== undefined) this.contractId = options.body.contractId;

        if (options.chunkDataBase64 !== undefined) this.chunkDataBase64 = options.chunkDataBase64;
        else if (options.body?.chunkDataBase64 !== undefined) this.chunkDataBase64 = options.body.chunkDataBase64;

        if (options.merkleSiblings !== undefined) this.merkleSiblings = options.merkleSiblings;
        else if (options.body?.merkleSiblings !== undefined) this.merkleSiblings = options.body.merkleSiblings;

        if (options.computedRootMatch !== undefined) this.computedRootMatch = options.computedRootMatch;
        else if (options.body?.computedRootMatch !== undefined) this.computedRootMatch = options.body.computedRootMatch;
    }

    get contractId(): string { return this.body.contractId; }
    set contractId(value: string) { this.body = { ...this.body, contractId: value }; }

    get chunkDataBase64(): string { return this.body.chunkDataBase64; }
    set chunkDataBase64(value: string) { this.body = { ...this.body, chunkDataBase64: value }; }

    get merkleSiblings(): string[] { return this.body.merkleSiblings || []; }
    set merkleSiblings(value: string[]) { this.body = { ...this.body, merkleSiblings: value }; }

    get computedRootMatch(): boolean { return this.body.computedRootMatch; }
    set computedRootMatch(value: boolean) { this.body = { ...this.body, computedRootMatch: value }; }
}
