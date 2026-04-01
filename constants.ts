import * as crypto from 'crypto';

import { hashData } from './crypto_utils/CryptoUtils';
import type { Block } from './types';

export const GENESIS_TIMESTAMP = process.env.VERIMUS_GENESIS_TIMESTAMP ? parseInt(process.env.VERIMUS_GENESIS_TIMESTAMP) : 1774828800000; // March 30, 2026 00:00:00 UTC

export const BLOCK_TYPES = {
    TRANSACTION: 'TRANSACTION',
    STORAGE_CONTRACT: 'STORAGE_CONTRACT',
    STAKING_CONTRACT: 'STAKING_CONTRACT',
    SLASHING_TRANSACTION: 'SLASHING_TRANSACTION',
    CHECKPOINT: 'CHECKPOINT'
} as const;

export const GENESIS_SEED_DATA = Buffer.from(JSON.stringify({
    version: "1.0.0",
    genesis_timestamp: GENESIS_TIMESTAMP,
    erasure_baseline: "Reed-Solomon (K=1, N=1)",
    audit_decay_lambda: 0.214,
    consensus: "Spacetime + Proof of Stake"
}));

const fundingBlockBase = {
    metadata: {
        index: 0,
        timestamp: GENESIS_TIMESTAMP
    },
    type: BLOCK_TYPES.TRANSACTION,
    previousHash: '',
    payload: {
        senderId: 'SYSTEM',
        recipientId: 'SYSTEM',
        amount: Number.MAX_VALUE,
        senderSignature: ''
    },
    publicKey: 'SYSTEM',
    signature: 'sys_sig'
};

const contractBlockBase = {
    metadata: {
        index: 1,
        timestamp: GENESIS_TIMESTAMP
    },
    type: BLOCK_TYPES.STORAGE_CONTRACT,
    previousHash: hashData(JSON.stringify(fundingBlockBase)),
    payload: {
        marketId: 'GENESIS_MARKET',
        activeHosts: [],
        allocatedEgressEscrow: 0,
        remainingEgressEscrow: 0,
        erasureParams: { k: 1, n: 1, originalSize: GENESIS_SEED_DATA.length },
        fragmentMap: [{
            nodeId: 'GENESIS_NODE',
            shardIndex: 0,
            shardHash: crypto.createHash('sha256').update(GENESIS_SEED_DATA).digest('hex'),
            physicalId: 'GENESIS_PHYSICAL_ID'
        }],
        merkleRoots: [crypto.createHash('sha256').update(GENESIS_SEED_DATA).digest('hex')],
        encryptedPayloadBase64: GENESIS_SEED_DATA.toString('base64'),
        encryptedKeyBase64: 'GENESIS_KEY',
        encryptedIvBase64: 'GENESIS_IV'
    },
    publicKey: 'SYSTEM',
    signature: 'GENESIS_SIG'
};

export const GENESIS_FUNDING_BLOCK = {
    ...fundingBlockBase,
    hash: hashData(JSON.stringify(fundingBlockBase))
} as Block;

export const GENESIS_STORAGE_CONTRACT = {
    ...contractBlockBase,
    hash: hashData(JSON.stringify(contractBlockBase))
} as Block;

export const calculateAuditDecayInterval = (genesisTimestamp: number, currentTimestamp: number = Date.now()): number => {
    const daysSinceGenesis = Math.max(0, (currentTimestamp - genesisTimestamp) / (1000 * 60 * 60 * 24));
    const LAMBDA = 0.214;
    return 60000 + 3540000 * (1 - Math.exp(-LAMBDA * daysSinceGenesis));
};
