import { NodeRole } from './NodeRole';
import { BLOCK_TYPES } from '../constants';

export interface PeerConnection {
    peerAddress: string;
    send(message: object): void;
    remoteCredentials_?: { walletAddress?: string };
    roles?: NodeRole[]; // threaded role bounds per connection 
}

export type BlockType = typeof BLOCK_TYPES[keyof typeof BLOCK_TYPES];

export interface Validator {
    validatorAddress: string;
    stakeAmount: string;
}

export interface StorageProvider {
    operatorAddress: string;
    collateralAmount: string;
    minEpochTimelineDays: string;
}

export interface PeerReputation {
    operatorAddress: string;
    publicKey?: string;
    score: number;
    strikeCount: number;
    isBanned: boolean;
    lastOffense: string | null;
    roles?: NodeRole[];
}

export interface StoragePricingConfig {
    restCostPerGBHour: bigint;
    egressCostPerGB: bigint;
}

export interface TransactionPayload {
    senderSignature: string;
    senderAddress: string;
    recipientAddress: string;
    amount: bigint;
}

export interface ErasureParameters {
    n: bigint;
    k: bigint;
    originalSize: bigint;
}

export interface NodeShardMapping {
    nodeId: string;
    shardIndex: bigint;
    shardHash: string;
    physicalId?: string;
}

export interface StorageContractPayload {
    encryptedPayloadBase64: string;
    encryptedKeyBase64?: string;
    encryptedIvBase64?: string;
    encryptedAuthTagBase64?: string;
    allocatedRestToll?: bigint;
    expirationBlockHeight?: bigint;
    allocatedEgressEscrow?: bigint;
    remainingEgressEscrow?: bigint;
    marketId?: string;
    activeHosts?: string[];
    erasureParams?: ErasureParameters;
    fragmentMap?: NodeShardMapping[];
    merkleRoots?: string[]; // Phase 4b - Constant size 64-character hash resolving entire physical matrix dynamically
    ownerAddress?: string;
    ownerSignature?: string;
    brokerFeePercentage?: bigint;
}

export interface StakingContractPayload {
    operatorAddress: string;
    collateralAmount: bigint;
    minEpochTimelineDays: bigint;
}

export interface ValidatorRegistrationPayload {
    validatorAddress: string;
    stakeAmount: bigint;
    action: 'STAKE' | 'UNSTAKE';
}

export interface SlashingPayload {
    penalizedAddress: string;
    evidenceSignature: string;
    burntAmount: bigint;
}

export interface CheckpointStatePayload {
    epochIndex: bigint;
    startHash: string;
    endHash: string;
    stateMerkleRoot: string;
    activeContractsMerkleRoot: string;
}

export interface BlockPrivateFile {
    path: string;
    contentHash: string;
}

export interface LocalStorageLocation {
    type: 'local' | 'memory';
    storageDir?: string;
}

export interface S3StorageLocation {
    type: 's3';
    bucket: string;
}

export interface SambaStorageLocation {
    type: 'samba';
    share: string;
}

export interface RemoteFSStorageLocation {
    type: 'remote-fs';
    host: string;
    dir: string;
}

export interface GlacierStorageLocation {
    type: 'glacier';
    vault: string;
}

export interface GithubStorageLocation {
    type: 'github';
    owner: string;
    repo: string;
    branch?: string;
}

export interface GenericStorageLocation {
    type: string;
    [key: string]: any;
}

export type StorageLocation =
    | LocalStorageLocation
    | S3StorageLocation
    | SambaStorageLocation
    | RemoteFSStorageLocation
    | GlacierStorageLocation
    | GithubStorageLocation
    | GenericStorageLocation;

export interface BlockPrivate {
    key?: string;
    encryptedAesKey?: string;
    iv: string;
    authTag?: string;
    location: StorageLocation;
    physicalId: string;
    files: BlockPrivateFile[];
}

export interface BlockMetadata {
    index: number;
    timestamp: number;
}

export interface BaseBlock {
    previousHash?: string;
    hash?: string;
    metadata: BlockMetadata;
    signerAddress: string;
    signature: string;
}

export interface TransactionBlock extends BaseBlock {
    type: typeof BLOCK_TYPES.TRANSACTION;
    payload: TransactionPayload;
}

export interface StorageContractBlock extends BaseBlock {
    type: typeof BLOCK_TYPES.STORAGE_CONTRACT;
    payload: StorageContractPayload; // The encrypted payload mapped
}

export interface StakingContractBlock extends BaseBlock {
    type: typeof BLOCK_TYPES.STAKING_CONTRACT;
    payload: StakingContractPayload;
}

export interface ValidatorRegistrationBlock extends BaseBlock {
    type: typeof BLOCK_TYPES.VALIDATOR_REGISTRATION;
    payload: ValidatorRegistrationPayload;
}

export interface SlashingTransactionBlock extends BaseBlock {
    type: typeof BLOCK_TYPES.SLASHING_TRANSACTION;
    payload: SlashingPayload;
}

export interface CheckpointBlock extends BaseBlock {
    type: typeof BLOCK_TYPES.CHECKPOINT;
    payload: CheckpointStatePayload;
}

export type Block = TransactionBlock | StorageContractBlock | StakingContractBlock | SlashingTransactionBlock | CheckpointBlock | ValidatorRegistrationBlock;

declare module '@marsaud/smb2';