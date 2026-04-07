import { Message } from '../../p2p';
import { MessageOptions } from '../types/Types';

export interface MerkleProofChallengeRequestOptions {
    contractId: string;
    physicalId: string;
    auditorPublicKey: string;
    auditorNodeId: string;
    targetNodeId: string;
    chunkIndex: number;
    nonce?: number;
}

export class MerkleProofChallengeRequestMessage extends Message {
    constructor(options: MessageOptions<MerkleProofChallengeRequestOptions> = {}) {
        super(options);
        
        if (options.contractId !== undefined) this.contractId = options.contractId;
        else if (options.body?.contractId !== undefined) this.contractId = options.body.contractId;

        if (options.physicalId !== undefined) this.physicalId = options.physicalId;
        else if (options.body?.physicalId !== undefined) this.physicalId = options.body.physicalId;

        if (options.auditorPublicKey !== undefined) this.auditorPublicKey = options.auditorPublicKey;
        else if (options.body?.auditorPublicKey !== undefined) this.auditorPublicKey = options.body.auditorPublicKey;

        if (options.auditorNodeId !== undefined) this.auditorNodeId = options.auditorNodeId;
        else if (options.body?.auditorNodeId !== undefined) this.auditorNodeId = options.body.auditorNodeId;

        if (options.targetNodeId !== undefined) this.targetNodeId = options.targetNodeId;
        else if (options.body?.targetNodeId !== undefined) this.targetNodeId = options.body.targetNodeId;

        if (options.chunkIndex !== undefined) this.chunkIndex = options.chunkIndex;
        else if (options.body?.chunkIndex !== undefined) this.chunkIndex = options.body.chunkIndex;

        if (options.nonce !== undefined) this.nonce = options.nonce;
        else if (options.body?.nonce !== undefined) this.nonce = options.body.nonce;
    }

    get contractId(): string { return this.body.contractId; }
    set contractId(value: string) { this.body = { ...this.body, contractId: value }; }

    get physicalId(): string { return this.body.physicalId; }
    set physicalId(value: string) { this.body = { ...this.body, physicalId: value }; }

    get auditorPublicKey(): string { return this.body.auditorPublicKey; }
    set auditorPublicKey(value: string) { this.body = { ...this.body, auditorPublicKey: value }; }

    get auditorNodeId(): string { return this.body.auditorNodeId; }
    set auditorNodeId(value: string) { this.body = { ...this.body, auditorNodeId: value }; }

    get targetNodeId(): string { return this.body.targetNodeId; }
    set targetNodeId(value: string) { this.body = { ...this.body, targetNodeId: value }; }

    get chunkIndex(): number { return this.body.chunkIndex; }
    set chunkIndex(value: number) { this.body = { ...this.body, chunkIndex: value }; }

    get nonce(): number | undefined { return this.body.nonce; }
    set nonce(value: number | undefined) { this.body = { ...this.body, nonce: value }; }
}
