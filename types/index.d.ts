import { NodeRole } from './NodeRole';

export interface PeerConnection {
    peerAddress: string;
    send(message: object): void;
    remoteCredentials_?: { rsaKeyPair?: { public?: Buffer } };
    roles?: NodeRole[]; // Dynamically threaded role bounds per connection 
}

export type BlockType = 'TRANSACTION' | 'STORAGE_CONTRACT';

export interface PeerReputation {
    _id?: any;
    publicKey: string;
    score: number;
    strikeCount: number;
    isBanned: boolean;
    lastOffense: string | null;
    roles?: NodeRole[];
}

export interface TransactionPayload {
    senderSignature: string; 
    senderId: string;        
    recipientId: string;     
    amount: number;         
}

export interface StorageContractPayload {
    encryptedPayloadBase64: string;
    encryptedKeyBase64: string;
    encryptedIvBase64: string;
    encryptedAuthTagBase64?: string;
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
    key: string;
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
    _id?: any;
    previousHash?: string;
    hash?: string;
    metadata: BlockMetadata;
    publicKey: string;
    signature: string;
}

export interface TransactionBlock extends BaseBlock {
    type: 'TRANSACTION';
    payload: TransactionPayload;
}

export interface StorageContractBlock extends BaseBlock {
    type: 'STORAGE_CONTRACT';
    payload: StorageContractPayload; // The encrypted payload securely mapped
}

export type Block = TransactionBlock | StorageContractBlock;