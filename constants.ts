import * as crypto from 'crypto';

import { ethers } from 'ethers';


import type { Block } from './types';

export const GENESIS_TIMESTAMP = process.env.VERIMUS_GENESIS_TIMESTAMP ? parseInt(process.env.VERIMUS_GENESIS_TIMESTAMP) : 1776038400000; // April 13, 2026 00:00:00 UTC

export const IS_DEV_NETWORK = process.env.NODE_ENV !== 'production';

if (!('toJSON' in BigInt.prototype)) {
    (BigInt.prototype as any).toJSON = function () { return this.toString(); };
}

export const BLOCK_TYPES = {
    TRANSACTION: 'TRANSACTION',
    STORAGE_CONTRACT: 'STORAGE_CONTRACT',
    STAKING_CONTRACT: 'STAKING_CONTRACT',
    SLASHING_TRANSACTION: 'SLASHING_TRANSACTION',
    CHECKPOINT: 'CHECKPOINT',
    VALIDATOR_REGISTRATION: 'VALIDATOR_REGISTRATION'
} as const;

export const EPOCH_LENGTH = 100;
export const AVERAGE_BLOCK_TIME_MS = 5000;

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
        senderAddress: ethers.ZeroAddress,
        recipientAddress: ethers.ZeroAddress,
        amount: ethers.parseUnits("9999999999", 18),
        senderSignature: ''
    },
    signerAddress: ethers.ZeroAddress,
    signature: 'GENESIS_SIG'
};

const contractBlockBase = {
    metadata: {
        index: 1,
        timestamp: GENESIS_TIMESTAMP
    },
    type: BLOCK_TYPES.STORAGE_CONTRACT,
    previousHash: crypto.createHash('sha256').update(JSON.stringify(fundingBlockBase)).digest('hex'),
    payload: {
        marketId: 'GENESIS_MARKET',
        activeHosts: [],
        allocatedEgressEscrow: 0n,
        remainingEgressEscrow: 0n,
        erasureParams: { k: 1n, n: 1n, originalSize: BigInt(GENESIS_SEED_DATA.length) },
        fragmentMap: [{
            nodeId: 'GENESIS_NODE',
            shardIndex: 0n,
            shardHash: crypto.createHash('sha256').update(GENESIS_SEED_DATA).digest('hex'),
            physicalId: 'GENESIS_PHYSICAL_ID'
        }],
        merkleRoots: [crypto.createHash('sha256').update(GENESIS_SEED_DATA).digest('hex')],
        encryptedPayloadBase64: GENESIS_SEED_DATA.toString('base64'),
        encryptedKeyBase64: 'GENESIS_KEY',
        encryptedIvBase64: 'GENESIS_IV'
    },
    signerAddress: ethers.ZeroAddress,
    signature: 'GENESIS_SIG'
};

export const GENESIS_FUNDING_BLOCK = {
    ...fundingBlockBase,
    hash: crypto.createHash('sha256').update(JSON.stringify(fundingBlockBase)).digest('hex')
} as Block;

export const GENESIS_STORAGE_CONTRACT = {
    ...contractBlockBase,
    hash: crypto.createHash('sha256').update(JSON.stringify(contractBlockBase)).digest('hex')
} as Block;

export const calculateAuditDecayInterval = (genesisTimestamp: number, currentTimestamp: number = Date.now()): number => {
    const daysSinceGenesis = Math.max(0, (currentTimestamp - genesisTimestamp) / (1000 * 60 * 60 * 24));
    const LAMBDA = 0.214;
    return 60000 + 3540000 * (1 - Math.exp(-LAMBDA * daysSinceGenesis));
};
