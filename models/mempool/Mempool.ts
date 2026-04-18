import type { PeerConnection, Block } from '../../types';

export interface PendingBlockEntry {
    block: Block;
    verifications: Set<string>;
    originalTimestamp: number;
    eligible?: boolean;
    committed?: boolean;
    strikes?: number;
    rebroadcastCount?: number;
}

export interface ForkEntry {
    blockIds: string[];
    proposals: Set<string>;
    adopted?: boolean;
    computedBlocks?: Block[];
}

export interface SettledForkEntry {
    finalTipHash: string;
    adoptions: Set<string>;
    committed?: boolean;
    pendingCommit?: boolean;
}

class Mempool {
    pendingBlocks: Map<string, PendingBlockEntry>;
    eligibleForks: Map<string, ForkEntry>;
    settledForks: Map<string, SettledForkEntry>;
    orphanedVerifications: Map<string, { signature: string, connection: PeerConnection }[]>;

    constructor() {
        this.pendingBlocks = new Map(); // blockId -> { block, verifications: Set(peerAddress) }
        this.eligibleForks = new Map(); // forkId -> { blockIds, proposals: Set(peerAddress) }
        this.settledForks = new Map();   // forkId -> { finalTipHash, adoptions: Set(peerAddress) }
        this.orphanedVerifications = new Map(); // blockId -> [{ signature, peerAddress }]
    }
}

export default Mempool;
