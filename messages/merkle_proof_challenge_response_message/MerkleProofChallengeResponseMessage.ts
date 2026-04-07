import { Message } from '../../p2p';
import { MessageOptions } from '../types/Types';

export interface MerkleProofChallengeResponseOptions {
    contractId: string;
    physicalId: string;
    auditorNodeId: string;
    chunkDataBase64: string; 
    merkleSiblings: string[];
    computedRootMatch: boolean;
    nonce?: number;
}

export class MerkleProofChallengeResponseMessage extends Message {
    constructor(options: MessageOptions<MerkleProofChallengeResponseOptions> = {}) {
        super(options);
        
        if (options.contractId !== undefined) this.contractId = options.contractId;
        else if (options.body?.contractId !== undefined) this.contractId = options.body.contractId;

        if (options.physicalId !== undefined) this.physicalId = options.physicalId;
        else if (options.body?.physicalId !== undefined) this.physicalId = options.body.physicalId;

        if (options.auditorNodeId !== undefined) this.auditorNodeId = options.auditorNodeId;
        else if (options.body?.auditorNodeId !== undefined) this.auditorNodeId = options.body.auditorNodeId;

        if (options.chunkDataBase64 !== undefined) this.chunkDataBase64 = options.chunkDataBase64;
        else if (options.body?.chunkDataBase64 !== undefined) this.chunkDataBase64 = options.body.chunkDataBase64;

        if (options.merkleSiblings !== undefined) this.merkleSiblings = options.merkleSiblings;
        else if (options.body?.merkleSiblings !== undefined) this.merkleSiblings = options.body.merkleSiblings;

        if (options.computedRootMatch !== undefined) this.computedRootMatch = options.computedRootMatch;
        else if (options.body?.computedRootMatch !== undefined) this.computedRootMatch = options.body.computedRootMatch;

        if (options.nonce !== undefined) this.nonce = options.nonce;
        else if (options.body?.nonce !== undefined) this.nonce = options.body.nonce;
    }

    get contractId(): string { return this.body.contractId; }
    set contractId(value: string) { this.body = { ...this.body, contractId: value }; }

    get physicalId(): string { return this.body.physicalId; }
    set physicalId(value: string) { this.body = { ...this.body, physicalId: value }; }

    get auditorNodeId(): string { return this.body.auditorNodeId; }
    set auditorNodeId(value: string) { this.body = { ...this.body, auditorNodeId: value }; }

    get chunkDataBase64(): string { return this.body.chunkDataBase64; }
    set chunkDataBase64(value: string) { this.body = { ...this.body, chunkDataBase64: value }; }

    get merkleSiblings(): string[] { return this.body.merkleSiblings || []; }
    set merkleSiblings(value: string[]) { this.body = { ...this.body, merkleSiblings: value }; }

    get computedRootMatch(): boolean { return this.body.computedRootMatch; }
    set computedRootMatch(value: boolean) { this.body = { ...this.body, computedRootMatch: value }; }

    get nonce(): number | undefined { return this.body.nonce; }
    set nonce(value: number | undefined) { this.body = { ...this.body, nonce: value }; }
}
