import { MongoClient, Db, Collection } from 'mongodb';
import { EventEmitter } from 'events';

import { hashData } from './cryptoUtils';
import type { Block, PeerReputation } from './types';


class Ledger {
    client: MongoClient;
    db: Db | null;
    collection: Collection<Block> | null;
    peersCollection: Collection<PeerReputation> | null;
    ownedBlocksCollection: Collection<any> | null;
    events: EventEmitter;
    constructor(mongoUri: string = 'mongodb://127.0.0.1:27017') {
        this.client = new MongoClient(mongoUri, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000,
            maxPoolSize: 50,
            writeConcern: { w: 'majority', wtimeoutMS: 2500 },
            retryWrites: true
        });
        this.db = null;
        this.collection = null;
        this.peersCollection = null;
        this.ownedBlocksCollection = null;
        this.events = new EventEmitter();
    }

    async init(port: number) {
        await this.client.connect();
        this.db = this.client.db(`secure_storage_db_${port}`);
        this.collection = this.db.collection('blocks');
        this.peersCollection = this.db.collection('peers');
        this.ownedBlocksCollection = this.db.collection('ownedBlocks');

        // Enforce strict mathematical sequence indexing to prevent silent ledger race bounds mapping identical heights 
        await this.collection.createIndex({ "metadata.index": 1 }, { unique: true });

        // Ensure peer lookups by publicKey are securely bound mathematically O(1) matching uniquely natively
        await this.peersCollection.createIndex({ "publicKey": 1 }, { unique: true });

        await this.ownedBlocksCollection.createIndex({ hash: 1 }, { unique: true });

        // Ensure genesis block exists
        const count = await this.collection.countDocuments();
        if (count === 0) {
            const genesis = this.createGenesisBlock();
            await this.collection.insertOne(genesis);
        }
    }

    createGenesisBlock() {
        return {
            metadata: {
                index: 0,
                timestamp: 1700000000000 // deterministic genesis timestamp
            },
            previousHash: '',
            hash: hashData(''),
            private: {
                encryptedPayloadBase64: '',
                encryptedKeyBase64: '',
                encryptedIvBase64: ''
            },
            publicKey: '',
            signature: '',
        };
    }

    async getLatestBlock() {
        // We now sort by metadata.index
        const result = await this.collection!.find().sort({ "metadata.index": -1 }).limit(1).toArray();
        return result[0];
    }

    async getBlockByIndex(index: number) {
        return await this.collection!.findOne({ "metadata.index": index });
    }

    async purgeChain() {
        // Drop all blocks completely securing bounds
        // DO NOT drop peersCollection. Not doing so persists reputation across reboots.
        await this.collection!.deleteMany({});
        const genesis = this.createGenesisBlock();
        await this.collection!.insertOne(genesis);
    }

    async addBlockToChain(block: Block) {
        await this.collection!.insertOne(block);
        this.events.emit('blockAdded', block);
        return block;
    }

    /**
     * Generates a block comprising the previous hash, publicKey, 
     * encrypted private payload, and signature.
     */
    async addBlock(publicKey: string, privatePayload: any, signatureStr: string) {
        const previousBlock = await this.getLatestBlock();
        const newBlock: Block = {
            metadata: {
                index: previousBlock.metadata.index + 1,
                timestamp: Date.now()
            },
            previousHash: previousBlock.hash,
            publicKey: publicKey,
            private: privatePayload,
            signature: signatureStr
        };
        newBlock.hash = hashData(JSON.stringify(newBlock));
        await this.collection!.insertOne(newBlock);
        this.events.emit('blockAdded', newBlock);
        return newBlock;
    }

    async isChainValid() {
        const cursor = this.collection!.find().sort({ "metadata.index": 1 });
        let previousBlock: any = null;

        for await (const currentBlock of cursor) {
            if (previousBlock) {
                // Remove the hash before recalculating
                const blockToHash = { ...currentBlock };
                delete blockToHash.hash;
                delete (blockToHash as any)._id; // Ensure MongoDB internal ID isn't hashed

                const recalculatedHash = hashData(JSON.stringify(blockToHash));

                if (currentBlock.hash !== recalculatedHash) {
                    return false;
                }

                if (currentBlock.previousHash !== previousBlock.hash) {
                    return false;
                }
            }
            previousBlock = currentBlock;
        }
        return true;
    }
}

export default Ledger;
