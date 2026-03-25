import { EventEmitter } from 'events';

import type { Collection, MongoClient, Db, InsertOneResult } from 'mongodb';

import Ledger from '../../ledger/Ledger';
import type { Block, PeerReputation } from '../../types';

export class MockCollection<T extends { [key: string]: any }> {
    data: T[] = [];
    testMarker: boolean = true;

    async countDocuments(): Promise<number> { return this.data.length; }

    async insertOne(doc: T): Promise<InsertOneResult<T>> {
        this.data.push(doc);
        return { acknowledged: true, insertedId: null as any };
    }

    find() {
        return {
            sort: () => this,
            limit: () => this,
            toArray: async (): Promise<T[]> => this.data
        };
    }

    async findOne(_unusedQuery: any): Promise<T | null> {
        return this.data.length > 0 ? this.data[0] : null;
    }

    async insertMany(docs: T[]): Promise<any> {
        this.data.push(...docs);
        return { acknowledged: true, insertedCount: docs.length };
    }
}

export class MockLedger extends Ledger {
    // We explicitly overwrite the physical drivers with mock counterparts to safely simulate ledger loops
    // @ts-ignore - suppressing strict MongoClient overlaps to simulate collections offline natively
    client: MongoClient = {};
    db: Db | null = null;

    // @ts-ignore
    collection: Collection<Block> | null = null;
    // @ts-ignore
    peersCollection: Collection<PeerReputation> | null = null;
    // @ts-ignore
    ownedBlocksCollection: Collection<any> | null = null;

    events: EventEmitter;

    constructor() {
        super('mongodb://127.0.0.1:27017/mock'); // Bootstraps EventEmitter
        this.events = new EventEmitter();
    }

    async init() {
        // Circumvent physical connection logic connecting exactly to local MockCollections 
        this.collection = new MockCollection<Block>() as any;
        this.peersCollection = new MockCollection<PeerReputation>() as any;
        this.ownedBlocksCollection = new MockCollection<any>() as any;
    }
}
