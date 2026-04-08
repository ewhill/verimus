import { EventEmitter } from 'events';

import { MongoClient, Db, Collection } from 'mongodb';

import { BLOCK_TYPES, GENESIS_FUNDING_BLOCK, GENESIS_STORAGE_CONTRACT, EPOCH_LENGTH } from '../constants';
import { hashData } from '../crypto_utils/CryptoUtils';
import { hydrateBlockBigInts } from '../crypto_utils/EIP712Types';
import type { Block, PeerReputation, BlockType, Validator } from '../types';


class Ledger {
    client: MongoClient;
    db: Db | null;
    collection: Collection<Block> | null;
    peersCollection: Collection<PeerReputation> | null;
    ownedBlocksCollection: Collection<any> | null;
    balancesCollection: Collection<any> | null;
    activeContractsCollection: Collection<any> | null;
    activeValidatorsCollection: Collection<Validator> | null;
    orphanBlocksCollection: Collection<any> | null;
    activeValidatorCountCache: number = 0;
    events: EventEmitter;
    public blockAddedSubscribers: ((block: Block) => Promise<void>)[] = [];

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
        this.balancesCollection = null;
        this.activeContractsCollection = null;
        this.activeValidatorsCollection = null;
        this.orphanBlocksCollection = null;
        this.events = new EventEmitter();
    }

    async init(port: number) {
        await this.client.connect();
        this.db = this.client.db(`secure_storage_db_${port}`);
        this.collection = this.db.collection('blocks');
        this.peersCollection = this.db.collection('peers');
        this.ownedBlocksCollection = this.db.collection('ownedBlocks');
        this.balancesCollection = this.db.collection('balances');
        this.activeContractsCollection = this.db.collection('activeContracts');
        this.activeValidatorsCollection = this.db.collection('activeValidators');
        this.orphanBlocksCollection = this.db.collection('orphanBlocks');

        // Enforce strict mathematical sequence indexing to prevent silent ledger race bounds mapping identical heights 
        await this.collection.createIndex({ "metadata.index": 1 }, { unique: true });

        // Ensure peer lookups by publicKey are bound mathematically O(1) matching uniquely
        await this.peersCollection.createIndex({ "operatorAddress": 1 }, { unique: true });
        await this.ownedBlocksCollection.createIndex({ hash: 1 }, { unique: true });
        await this.balancesCollection.createIndex({ "walletAddress": 1 }, { unique: true });
        await this.activeContractsCollection.createIndex({ contractId: 1 }, { unique: true });
        await this.activeValidatorsCollection.createIndex({ "validatorAddress": 1 }, { unique: true });

        // Ensure genesis block exists
        const count = await this.collection.countDocuments();
        if (count === 0) {
            const genesisBlocks = this.createGenesisBlocks() as unknown as Array<Block & { _id: string }>;
            genesisBlocks[0]._id = genesisBlocks[0].hash!;
            genesisBlocks[1]._id = genesisBlocks[1].hash!;
            await this.collection.insertMany(genesisBlocks as any);
        }

        await this.syncValidatorCache();
    }

    async syncValidatorCache() {
        if (!this.activeValidatorsCollection) return;
        this.activeValidatorCountCache = await this.activeValidatorsCollection.countDocuments();
    }

    createGenesisBlocks(): [Block, Block] {
        return [
            JSON.parse(JSON.stringify(GENESIS_FUNDING_BLOCK)),
            JSON.parse(JSON.stringify(GENESIS_STORAGE_CONTRACT))
        ];
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
        await this.balancesCollection!.deleteMany({});
        await this.activeContractsCollection!.deleteMany({});
        await this.activeValidatorsCollection!.deleteMany({});
        await this.orphanBlocksCollection!.deleteMany({});

        const genesisBlocks = this.createGenesisBlocks() as unknown as Array<Block & { _id: string }>;
        genesisBlocks[0]._id = genesisBlocks[0].hash!;
        genesisBlocks[1]._id = genesisBlocks[1].hash!;
        
        const safelySerializedGenesis = JSON.parse(JSON.stringify(genesisBlocks));
        await this.collection!.insertMany(safelySerializedGenesis);
    }

    async pruneHistory(checkpointIndex: number) {
        if (!this.collection) return;
        // The checkpoint index serves as the new base limit. All prior blocks (except Genesis if we wanted) are burned.
        // Actually, we burn EVERYTHING strictly < checkpointIndex.
        await this.collection.deleteMany({ "metadata.index": { $lt: checkpointIndex } });
    }

    async addBlockToChain(block: Block) {
        const doc = { ...block, _id: block.hash };
        const safelySerializedDoc = JSON.parse(JSON.stringify(doc));
        await this.collection!.insertOne(safelySerializedDoc);
        
        if (block.metadata.index % EPOCH_LENGTH === 0) {
            await this.syncValidatorCache();
        }

        for (const sub of this.blockAddedSubscribers) {
            await sub(block);
        }
        this.events.emit('blockAdded', block);
        return block;
    }

    /**
     * Generates a block comprising the previous hash, signerAddress, 
     * encrypted private payload, and signature.
     */
    async addBlock(signerAddress: string, privatePayload: any, signatureStr: string, type: Exclude<BlockType, undefined> = BLOCK_TYPES.STORAGE_CONTRACT) {
        const previousBlock = await this.getLatestBlock();
        const newBlock: Block = {
            metadata: {
                index: previousBlock.metadata.index + 1,
                timestamp: Date.now()
            },
            // @ts-ignore
            type: type,
            previousHash: previousBlock.hash,
            signerAddress: signerAddress,
            payload: privatePayload,
            signature: signatureStr
        };
        newBlock.hash = hashData(JSON.stringify(newBlock));
        const doc = { ...newBlock, _id: newBlock.hash };
        await this.collection!.insertOne(doc as any);

        if (newBlock.metadata.index % EPOCH_LENGTH === 0) {
            await this.syncValidatorCache();
        }

        for (const sub of this.blockAddedSubscribers) {
            await sub(newBlock);
        }
        this.events.emit('blockAdded', newBlock);
        return newBlock;
    }

    async getExpiredContracts(currentIndex: number): Promise<Block[]> {
        const cursor = this.collection!.find({ type: BLOCK_TYPES.STORAGE_CONTRACT });
        const expiredBlocks: Block[] = [];
        
        for await (const block of cursor) {
            hydrateBlockBigInts(block);
            const payload = block.payload as any;
            if (payload?.expirationBlockHeight !== undefined && BigInt(payload.expirationBlockHeight) <= BigInt(currentIndex)) {
                expiredBlocks.push(block as unknown as Block);
            }
        }
        return expiredBlocks;
    }

    async isChainValid() {
        const cursor = this.collection!.find().sort({ "metadata.index": 1 });
        let previousBlock: any = null;

        for await (const currentBlock of cursor) {
            hydrateBlockBigInts(currentBlock);
            if (previousBlock) {
                // Remove the hash before recalculating
                const blockToHash = { ...currentBlock };
                delete blockToHash.hash;
                // @ts-ignore
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
