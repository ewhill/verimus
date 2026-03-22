export interface PeerConnection {
    peerAddress: string;
    send(message: object): void;
}

export interface PeerReputation {
    _id?: any;
    publicKey: string;
    score: number;
    strikeCount: number;
    isBanned: boolean;
    lastOffense: string | null;
}

export interface BlockMetadata {
    index: number;
    timestamp: number;
}

export interface EncryptedBlockPrivate {
    encryptedPayloadBase64: string;
    encryptedKeyBase64: string;
    encryptedIvBase64: string;
    encryptedAuthTagBase64?: string;
}

export interface BlockPrivateFile {
    path: string;
    contentHash: string;
}

export interface BlockPrivate {
    key: string;
    iv: string;
    authTag?: string;
    location: any; // Used to be StorageLocation, dynamically loaded via specific providers
    physicalId: string;
    files: BlockPrivateFile[];
}

export interface Block {
    _id?: any;
    /** Hash of previous block in the chain. A null value is used to indicate the block is not yet settled. */
    previousHash?: string;

    /** Hash of the block. A null value is used to indicate the block is not yet settled. */
    hash?: string;

    metadata: BlockMetadata;

    /** The private data included in the block. If encrypted, the type is EncryptedBlockPrivate. If decrypted, the type is BlockPrivate. */
    private: EncryptedBlockPrivate | BlockPrivate;

    /** The public key of the peer which submitted and owns this block */
    publicKey: string;

    /** The signature of the peer which submitted and owns this block. */
    signature: string;
}