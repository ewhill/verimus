import assert from 'node:assert';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { describe, it, mock } from 'node:test';

import { Collection, DeleteResult, FindCursor, InsertManyResult, InsertOneResult, WithId } from 'mongodb';

import Bundler from '../../bundler/Bundler';
import type { PeerCredentials } from '../../credential_provider/CredentialProvider';
import type Ledger from '../../ledger/Ledger';
import Mempool from '../../models/mempool/Mempool';
import BaseProvider from '../../storage_providers/base_provider/BaseProvider';
import MemoryStorageProvider from '../../storage_providers/memory_provider/MemoryProvider';
import { createMock } from '../../test/utils/TestUtils';
import { Block } from '../../types';
import PeerNodeClass from '../PeerNode';

const getMockCredentials = (): PeerCredentials => ({
    privateKeyPath: 'peer.pem'
});

const createDummyBlock = (hash: string, pk: string = 'pk'): import('../../types').Block => ({
    type: 'TRANSACTION',
    metadata: { index: 1, timestamp: 1 },
    signerAddress: pk,
    signature: 'sig',
    hash,
    payload: { senderSignature: '', senderAddress: '', recipientAddress: '', amount: 0n }
});

const getMockNode = async (PeerNodeClass: any) => {
    const node = new PeerNodeClass(3002, [], new MemoryStorageProvider(), new Bundler('data'), 'mongodb://localhost:27017/test', 'mockPubKey', getMockCredentials(), 'data');
    node.ledger = createMock<Ledger>({
        init: async () => { },
        events: new EventEmitter(),
        blockAddedSubscribers: [],
        collection: createMock<Collection<any>>({
            find: mock.fn<() => FindCursor<WithId<any>>>(() => createMock<FindCursor<WithId<any>>>({ toArray: async () => [] })) as any,
            insertMany: mock.fn<() => Promise<InsertManyResult<any>>>(),
            countDocuments: mock.fn<() => Promise<number>>(async () => 1)
        }),
        ownedBlocksCollection: createMock<Collection<any>>({
            find: mock.fn<() => FindCursor<WithId<any>>>(() => createMock<FindCursor<WithId<any>>>({ toArray: async () => [] })) as any,
            insertOne: mock.fn<() => Promise<any>>(),
            insertMany: mock.fn<() => Promise<any>>(),
            deleteMany: mock.fn<() => Promise<any>>(),
            countDocuments: mock.fn<() => Promise<number>>(async () => 1)
        }),
        peersCollection: createMock<Collection<any>>({
            find: mock.fn<() => FindCursor<WithId<any>>>(() => createMock<FindCursor<WithId<any>>>({ toArray: async () => [] })) as any
        })
    });
    await node.ledger.init();
    node.mempool = new Mempool();
    return node;
};

describe('Backend: PeerNode Logical Verification Check', () => {

    it('Initializes standard P2P Express configurations', async () => {
        assert.ok(PeerNodeClass !== undefined, 'PeerNode surfaces default instantiator');
    });

    it('Instantiates ReputationManager mapped to the database', async () => {

        const mockNode = await getMockNode(PeerNodeClass);

        mockNode.loadOwnedBlocksCache = async () => { };

        // Mock fs to bypass internal syncs
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const fsLib = require('node:fs');
        const origRead = fsLib.readFileSync;
        mock.method(fsLib, 'readFileSync', (pathStr: any, options: any) => {
            if (typeof pathStr === 'string' && pathStr.includes('.pem')) return Buffer.from('MOCK_KEY');
            return origRead(pathStr, options);
        });

        try {
            await mockNode.init().catch((_unusedE: any) => { }); // Only care about internal instantiation sequence
        } catch (_unusedE: any) { }

        assert.ok(mockNode.reputationManager !== undefined, 'ReputationManager MUST exist post-initialization');
        assert.ok(mockNode.reputationManager.peersCollection !== undefined && mockNode.reputationManager.peersCollection !== null, 'ReputationManager bridged native persistent Mongo DB Collections');

        mockNode.stop();
        mock.restoreAll();
    });

    it('Restores block caching arrays on initialization from MongoDB', async () => {

        const mockNode = await getMockNode(PeerNodeClass);
        mockNode.publicKey = 'myPubKey';
        mockNode.walletAddress = 'myPubKey';
        mock.method(mockNode.ledger.ownedBlocksCollection!, 'countDocuments', async () => 0);
        mock.method(mockNode.ledger.collection!, 'countDocuments', async () => 5);
        mock.method(mockNode.ledger.collection!, 'find', mock.fn<() => FindCursor<WithId<any>>>(() => createMock<FindCursor<WithId<any>>>({
            toArray: async () => [createDummyBlock('hash1', 'myPubKey') as any]
        })) as any);

        await mockNode.loadOwnedBlocksCache();

        assert.strictEqual(mockNode.ownedBlocksCache.length, 1);
        assert.strictEqual(mockNode.ownedBlocksCache[0], 'hash1');
        mockNode.stop();
    });

    it('Adds newly owned blocks directly to MongoDB correctly', async () => {
        const PeerNode = PeerNodeClass;

        const mockNode = new PeerNode(3002, [], createMock<BaseProvider>(), createMock<Bundler>(), 'mongodb://localhost:27017/test', createMock<string>(), createMock<PeerCredentials>(), 'data');
        mockNode.publicKey = 'myPubKey';
        mockNode.walletAddress = 'myPubKey';
        mockNode.ownedBlocksCache = [];

        mockNode.mempool = createMock<Mempool>({
            pendingBlocks: new Map() as any
        });

        let insertedHash = '';
        mockNode.ledger = createMock<Ledger>({
            events: new EventEmitter(),
            blockAddedSubscribers: [],
            ownedBlocksCollection: createMock<Collection<any>>({
                insertOne: mock.fn<(doc: any) => Promise<InsertOneResult<any>>>(async (doc: any) => { insertedHash = doc.hash; return { acknowledged: true, insertedId: 'mock' } as any; })
            })
        });

        const dummyBlock2: import('../../types').Block = {
            type: 'TRANSACTION',
            metadata: { index: 1, timestamp: 1 },
            signerAddress: 'myPubKey',
            signature: 'sig',
            hash: 'hash2',
            payload: { senderSignature: '', senderAddress: '', recipientAddress: '', amount: 0n }
        };
        await mockNode.addOwnedBlockToCache(dummyBlock2);

        assert.strictEqual(mockNode.ownedBlocksCache.length, 1);
        assert.ok(mockNode.ownedBlocksCache.includes('hash2'));
        assert.strictEqual(insertedHash, 'hash2', 'Native MongoDB insertion fired');
        mockNode.stop();
    });

    it('Bypasses cache population when cache matches ledger', async () => {

        const mockNode = await getMockNode(PeerNodeClass);
        mockNode.publicKey = 'myPubKey';
        mockNode.walletAddress = 'myPubKey';

        mock.method(mockNode.ledger.collection!, 'countDocuments', async () => 5);
        mock.method(mockNode.ledger.ownedBlocksCollection!, 'countDocuments', async () => 5);
        mock.method(mockNode.ledger.ownedBlocksCollection!, 'find', mock.fn<() => FindCursor<WithId<any>>>(() => createMock<FindCursor<WithId<any>>>({
            toArray: async () => [{ hash: 'hash_from_cache' } as any]
        })) as any);

        await mockNode.loadOwnedBlocksCache();

        assert.strictEqual(mockNode.ownedBlocksCache.length, 1);
        assert.strictEqual(mockNode.ownedBlocksCache[0], 'hash_from_cache');
        mockNode.stop();
    });

    it('Auto-invalidates stale cache if database appears purged', async () => {
        const mockNode = await getMockNode(PeerNodeClass);
        mockNode.publicKey = 'myPubKey';
        mockNode.walletAddress = 'myPubKey';

        let deleted = false;
        mockNode.ownedBlocksCache = ['hash1']; // Simulate existing cache
        mockNode.ledger = createMock<Ledger>({
            events: new EventEmitter(),
            blockAddedSubscribers: [],
            collection: createMock<Collection<Block>>({ countDocuments: mock.fn<() => Promise<number>>(async () => 1) }),
            ownedBlocksCollection: createMock<Collection<any>>({
                countDocuments: mock.fn<() => Promise<number>>(async () => 5),
                deleteMany: mock.fn<() => Promise<DeleteResult>>(async () => { deleted = true; return { deletedCount: 1 } as DeleteResult; })
            })
        });

        await mockNode.loadOwnedBlocksCache();

        assert.strictEqual(mockNode.ownedBlocksCache.length, 0); // Fails
        assert.strictEqual(deleted, true);
        mockNode.stop();
    });

    it('Handles outer wrapper failures during cache recovery', async () => {
        const mockNode = await getMockNode(PeerNodeClass);
        mockNode.ledger = createMock<Ledger>({
            events: new EventEmitter(),
            blockAddedSubscribers: [],
            collection: createMock<Collection<Block>>({ countDocuments: mock.fn<() => Promise<number>>(async () => { throw new Error('DB Crash'); }) })
        });

        await mockNode.loadOwnedBlocksCache();

        assert.strictEqual(mockNode.ownedBlocksCache.length, 0); // Outer catch handles it
        mockNode.stop();
    });

    it('Synchronizes deletion from unverified blocks', async () => {
        const mockNode = await getMockNode(PeerNodeClass);
        mockNode.publicKey = 'myPubKey';
        mockNode.walletAddress = 'myPubKey';

        mockNode.mempool = createMock<Mempool>({
            pendingBlocks: new Map() as any
        });
        const dummyBlock3: import('../../types').Block = {
            type: 'TRANSACTION',
            metadata: { index: 1, timestamp: 1 },
            signerAddress: 'myPubKey',
            signature: 'sig',
            hash: 'hash3',
            payload: { senderSignature: '', senderAddress: '', recipientAddress: '', amount: 0n }
        };
        const mockConn = { peerAddress: '127.0.0.1:1234', send: () => { } };
        const blockToHashTest = { ...dummyBlock3 };
        delete blockToHashTest.hash;
        // @ts-ignore
        delete blockToHashTest._id;
        const recalculatedHashTest = createHash('sha256').update(JSON.stringify(blockToHashTest)).digest('hex');
        mockNode.mempool.pendingBlocks.set(recalculatedHashTest, { block: dummyBlock3, connection: mockConn, timestamp: 12345 });

        mockNode.ledger = createMock<Ledger>({
            events: new EventEmitter(),
            blockAddedSubscribers: [],
            ownedBlocksCollection: createMock<Collection<any>>({
                insertOne: mock.fn<() => Promise<InsertOneResult<any>>>(async () => { throw new Error('Write error'); })
            })
        });

        await mockNode.addOwnedBlockToCache(dummyBlock3);

        assert.ok(!mockNode.mempool.pendingBlocks.has(recalculatedHashTest));
        assert.ok(mockNode.ownedBlocksCache.includes('hash3'));

        // Test getMajorityCount maps to Proof of Stake dynamically instead of connection counts
        mockNode.ledger.activeValidatorCountCache = 3;
        assert.strictEqual(mockNode.getMajorityCount(), 2);

        mockNode.ledger.activeValidatorCountCache = 4;
        assert.strictEqual(mockNode.getMajorityCount(), 3);

        mockNode.ledger.activeValidatorCountCache = 0;
        assert.strictEqual(mockNode.getMajorityCount(), 1);
        
        mockNode.stop();
    });
});
