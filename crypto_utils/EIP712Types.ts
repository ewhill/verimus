import { BLOCK_TYPES } from '../constants';
import type { Block } from '../types';

export const EIP712_DOMAIN = {
    name: 'Verimus',
    version: '1',
    chainId: 1337
};

export const BLOCK_METADATA_SCHEMA = [
    { name: 'index', type: 'int256' },
    { name: 'timestamp', type: 'uint256' }
];

export const TRANSACTION_PAYLOAD_SCHEMA = [
    { name: 'senderSignature', type: 'string' },
    { name: 'senderAddress', type: 'address' },
    { name: 'recipientAddress', type: 'address' },
    { name: 'amount', type: 'uint256' }
];

// Slashing Payload
export const SLASHING_PAYLOAD_SCHEMA = [
    { name: 'penalizedAddress', type: 'address' },
    { name: 'evidenceSignature', type: 'string' },
    { name: 'burntAmount', type: 'uint256' }
];

// Staking Payload
export const STAKING_CONTRACT_PAYLOAD_SCHEMA = [
    { name: 'operatorAddress', type: 'address' },
    { name: 'collateralAmount', type: 'uint256' },
    { name: 'minEpochTimelineDays', type: 'uint256' }
];

// Validator Registration Payload
export const VALIDATOR_REGISTRATION_PAYLOAD_SCHEMA = [
    { name: 'validatorAddress', type: 'address' },
    { name: 'stakeAmount', type: 'uint256' },
    { name: 'action', type: 'string' }
];

// Ensure we flatten or specify exact structs for nested arrays
export const ERASURE_PARAMS_SCHEMA = [
    { name: 'n', type: 'uint256' },
    { name: 'k', type: 'uint256' },
    { name: 'originalSize', type: 'uint256' }
];

export const NODE_SHARD_MAPPING_SCHEMA = [
    { name: 'nodeId', type: 'string' },
    { name: 'shardIndex', type: 'uint256' },
    { name: 'shardHash', type: 'string' },
    { name: 'physicalId', type: 'string' }
];

export const STORAGE_CONTRACT_PAYLOAD_SCHEMA = [
    { name: 'encryptedPayloadBase64', type: 'string' },
    { name: 'encryptedKeyBase64', type: 'string' },
    { name: 'encryptedIvBase64', type: 'string' },
    { name: 'encryptedAuthTagBase64', type: 'string' },
    { name: 'allocatedRestToll', type: 'uint256' },
    { name: 'allocatedEgressEscrow', type: 'uint256' },
    { name: 'remainingEgressEscrow', type: 'uint256' },
    { name: 'marketId', type: 'string' },
    { name: 'activeHosts', type: 'string[]' },
    { name: 'erasureParams', type: 'ErasureParameters' },
    { name: 'fragmentMap', type: 'NodeShardMapping[]' },
    { name: 'merkleRoots', type: 'string[]' },
    { name: 'ownerAddress', type: 'address' },
    { name: 'ownerSignature', type: 'string' },
    { name: 'brokerFeePercentage', type: 'uint256' }
];

export const CHECKPOINT_PAYLOAD_SCHEMA = [
    { name: 'epochIndex', type: 'uint256' },
    { name: 'startHash', type: 'string' },
    { name: 'endHash', type: 'string' },
    { name: 'stateMerkleRoot', type: 'string' },
    { name: 'activeContractsMerkleRoot', type: 'string' }
];


// Final Types Dictionary 
export const EIP712_SCHEMAS: Record<string, Record<string, Array<{name: string, type: string}>>> = {
    [BLOCK_TYPES.TRANSACTION]: {
        Block: [
            { name: 'type', type: 'string' },
            { name: 'signerAddress', type: 'address' },
            { name: 'payload', type: 'TransactionPayload' }
        ],
        TransactionPayload: TRANSACTION_PAYLOAD_SCHEMA
    },
    [BLOCK_TYPES.STORAGE_CONTRACT]: {
        Block: [
            { name: 'type', type: 'string' },
            { name: 'signerAddress', type: 'address' },
            { name: 'payload', type: 'StorageContractPayload' }
        ],
        StorageContractPayload: STORAGE_CONTRACT_PAYLOAD_SCHEMA,
        ErasureParameters: ERASURE_PARAMS_SCHEMA,
        NodeShardMapping: NODE_SHARD_MAPPING_SCHEMA
    },
    [BLOCK_TYPES.STAKING_CONTRACT]: {
        Block: [
            { name: 'type', type: 'string' },
            { name: 'signerAddress', type: 'address' },
            { name: 'payload', type: 'StakingContractPayload' }
        ],
        StakingContractPayload: STAKING_CONTRACT_PAYLOAD_SCHEMA
    },
    [BLOCK_TYPES.VALIDATOR_REGISTRATION]: {
        Block: [
            { name: 'type', type: 'string' },
            { name: 'signerAddress', type: 'address' },
            { name: 'payload', type: 'ValidatorRegistrationPayload' }
        ],
        ValidatorRegistrationPayload: VALIDATOR_REGISTRATION_PAYLOAD_SCHEMA
    },
    [BLOCK_TYPES.SLASHING_TRANSACTION]: {
        Block: [
            { name: 'type', type: 'string' },
            { name: 'signerAddress', type: 'address' },
            { name: 'payload', type: 'SlashingPayload' }
        ],
        SlashingPayload: SLASHING_PAYLOAD_SCHEMA
    },
    [BLOCK_TYPES.CHECKPOINT]: {
        Block: [
            { name: 'type', type: 'string' },
            { name: 'signerAddress', type: 'address' },
            { name: 'payload', type: 'CheckpointPayload' }
        ],
        CheckpointPayload: CHECKPOINT_PAYLOAD_SCHEMA
    }
};

/**
 * Normalizes optional values filling them manually with empty strings or 0 natively gracefully natively matching Web3 constraints perfectly efficiently
 * Ethers EIP-712 requires all properties mathematically map to their struct definitions seamlessly, otherwise rejecting dynamically explicitly organically.
 */
export const normalizeBlockForSignature = (block: Block): Record<string, any> => {
    // Base properties standard fills logically
    if (!block.previousHash) block.previousHash = "";

    const b: any = { ...block, payload: { ...block.payload } };

    // Type specific map structures gracefully mapping BSON Long constraints preventing object fragmentation
    if (b.type === BLOCK_TYPES.STORAGE_CONTRACT) {
        const p = b.payload;
        p.encryptedKeyBase64 = p.encryptedKeyBase64 || "";
        p.encryptedIvBase64 = p.encryptedIvBase64 || "";
        p.encryptedAuthTagBase64 = p.encryptedAuthTagBase64 || "";
        p.allocatedRestToll = p.allocatedRestToll ? p.allocatedRestToll.toString() : "0";
        p.allocatedEgressEscrow = p.allocatedEgressEscrow ? p.allocatedEgressEscrow.toString() : "0";
        p.remainingEgressEscrow = p.remainingEgressEscrow ? p.remainingEgressEscrow.toString() : "0";
        p.marketId = p.marketId || "";
        p.activeHosts = p.activeHosts || [];
        p.erasureParams = p.erasureParams || { n: 0, k: 0, originalSize: 0 };
        p.fragmentMap = p.fragmentMap || [];
        p.fragmentMap.forEach((f: any) => { f.physicalId = f.physicalId || ""; });
        p.merkleRoots = p.merkleRoots || [];
        p.ownerAddress = p.ownerAddress || "0x0000000000000000000000000000000000000000";
        p.ownerSignature = p.ownerSignature || "";
        p.brokerFeePercentage = p.brokerFeePercentage ? p.brokerFeePercentage.toString() : "0";
    }

    if (b.type === BLOCK_TYPES.TRANSACTION) {
        b.payload.amount = b.payload.amount ? b.payload.amount.toString() : "0";
    }

    if (b.type === BLOCK_TYPES.STAKING_CONTRACT) {
        b.payload.collateralAmount = b.payload.collateralAmount ? b.payload.collateralAmount.toString() : "0";
        b.payload.minEpochTimelineDays = b.payload.minEpochTimelineDays ? b.payload.minEpochTimelineDays.toString() : "0";
    }

    if (b.type === BLOCK_TYPES.SLASHING_TRANSACTION) {
        b.payload.burntAmount = b.payload.burntAmount ? b.payload.burntAmount.toString() : "0";
    }

    // Deep clone stripped logic avoiding memory mutation while resolving strings dynamically
    const outB = JSON.parse(JSON.stringify(b));

    return {
        type: outB.type,
        signerAddress: outB.signerAddress,
        payload: outB.payload
    };
};

/**
 * Hydrates deeply structured BigInt mathematical constants restoring strings efficiently dynamically correctly over native limits organically logically.
 */
export const hydrateBlockBigInts = (block: Block): void => {
    if (block.type === BLOCK_TYPES.STORAGE_CONTRACT) {
        const p = block.payload as any;
        if (p.allocatedEgressEscrow !== undefined) p.allocatedEgressEscrow = BigInt(p.allocatedEgressEscrow.toString());
        if (p.remainingEgressEscrow !== undefined) p.remainingEgressEscrow = BigInt(p.remainingEgressEscrow.toString());
        if (p.allocatedRestToll !== undefined) p.allocatedRestToll = BigInt(p.allocatedRestToll.toString());
        if (p.brokerFeePercentage !== undefined) p.brokerFeePercentage = BigInt(p.brokerFeePercentage.toString());
    } else if (block.type === BLOCK_TYPES.TRANSACTION) {
        const p = block.payload as any;
        if (p.amount !== undefined) p.amount = BigInt(p.amount.toString());
    } else if (block.type === BLOCK_TYPES.STAKING_CONTRACT) {
        const p = block.payload as any;
        if (p.collateralAmount !== undefined) p.collateralAmount = BigInt(p.collateralAmount.toString());
        if (p.minEpochTimelineDays !== undefined) p.minEpochTimelineDays = BigInt(p.minEpochTimelineDays.toString());
    } else if (block.type === BLOCK_TYPES.SLASHING_TRANSACTION) {
        const p = block.payload as any;
        if (p.burntAmount !== undefined) p.burntAmount = BigInt(p.burntAmount.toString());
    } else if (block.type === BLOCK_TYPES.VALIDATOR_REGISTRATION) {
        const p = block.payload as any;
        if (p.stakeAmount !== undefined) p.stakeAmount = BigInt(p.stakeAmount.toString());
    }
};
