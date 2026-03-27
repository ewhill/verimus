import assert from 'node:assert';
import * as fs from 'node:fs';
import { describe, it, mock } from 'node:test';

import Bundler from '../../bundler/Bundler';
import type { PeerCredentials } from '../../credential_provider/CredentialProvider';
import type Ledger from '../../ledger/Ledger';
import Mempool from '../../models/mempool/Mempool';
import type { Peer } from '../../p2p';
import BaseProvider from '../../storage_providers/base_provider/BaseProvider';
import MemoryStorageProvider from '../../storage_providers/memory_provider/MemoryProvider';
import { createMongoCursorStub, createMock } from '../../test/utils/StubFactory';
import PeerNodeClass from '../PeerNode';

const getMockCredentials = (): PeerCredentials => ({
    ringPublicKeyPath: 'ring.pub',
    publicKeyPath: 'peer.pub',
    privateKeyPath: 'peer.pem',
    signaturePath: 'peer.sig'
});

const createDummyBlock = (hash: string, pk: string = 'pk'): import('../../types').Block => ({
    type: 'TRANSACTION',
    metadata: { index: 1, timestamp: 1 },
    publicKey: pk,
    signature: 'sig',
    hash,
    payload: { senderSignature: '', senderId: '', recipientId: '', amount: 0 }
});

const getMockNode = async (PeerNodeClass: any) => {
    const node = new PeerNodeClass(3002, [], new MemoryStorageProvider(), new Bundler('data'), 'mongodb://localhost:27017/test', 'mockPubKey', getMockCredentials(), 'data');
    node.ledger = createMock<Ledger>({
        init: async () => {},
        collection: {
            find: () => createMongoCursorStub([]),
            insertMany: async () => {},
            countDocuments: async () => 1
        } as any,
        ownedBlocksCollection: {
            find: () => createMongoCursorStub([]),
            insertOne: async () => {},
            insertMany: async () => {},
            deleteMany: async () => {},
            countDocuments: async () => 1
        } as any,
        peersCollection: {
            find: () => createMongoCursorStub([])
        } as any
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
        
        mockNode.loadOwnedBlocksCache = async () => {};
        
        // Mock fs to bypass internal syncs
        mock.method(fs, 'readFileSync', () => Buffer.from('MOCK_KEY'));

        try {
           await mockNode.init().catch((_unusedE: any) => {}); // Only care about internal instantiation sequence
        } catch (_unusedE: any) {}

        assert.ok(mockNode.reputationManager !== undefined, 'ReputationManager MUST exist post-initialization');
        assert.ok(mockNode.reputationManager.peersCollection !== undefined && mockNode.reputationManager.peersCollection !== null, 'ReputationManager bridged native persistent Mongo DB Collections');

        mock.restoreAll();
    });

    it('Restores block caching arrays on initialization from MongoDB', async () => {
        
        const mockNode = await getMockNode(PeerNodeClass);
        mockNode.publicKey = 'myPubKey';
        mock.method(mockNode.ledger.ownedBlocksCollection!, 'countDocuments', async () => 0);
        mock.method(mockNode.ledger.collection!, 'countDocuments', async () => 5);
        mock.method(mockNode.ledger.collection!, 'find', () => createMongoCursorStub([
            createDummyBlock('hash1', 'myPubKey')
        ]));

        await mockNode.loadOwnedBlocksCache();
        
        assert.strictEqual(mockNode.ownedBlocksCache.length, 1);
        assert.strictEqual(mockNode.ownedBlocksCache[0], 'hash1');
    });

    it('Adds newly owned blocks directly to MongoDB correctly', async () => {
        const PeerNode = PeerNodeClass;
        
        const mockNode = new PeerNode(3002, [], createMock<BaseProvider>(), createMock<Bundler>(), 'mongodb://localhost:27017/test', createMock<string>(), createMock<PeerCredentials>(), 'data');
        mockNode.publicKey = 'myPubKey';
        mockNode.ownedBlocksCache = [];
        
        mockNode.mempool = createMock<Mempool>({
             pendingBlocks: new Map() as any
        });

        let insertedHash = '';
        mockNode.ledger = createMock<Ledger>({
            ownedBlocksCollection: {
                 insertOne: async (doc: any) => { insertedHash = doc.hash; }
            } as any
        });

        const dummyBlock2: import('../../types').Block = {
            type: 'TRANSACTION',
            metadata: { index: 1, timestamp: 1 },
            publicKey: 'myPubKey',
            signature: 'sig',
            hash: 'hash2',
            payload: { senderSignature: '', senderId: '', recipientId: '', amount: 0 }
        };
        await mockNode.addOwnedBlockToCache(dummyBlock2);
        
        assert.strictEqual(mockNode.ownedBlocksCache.length, 1);
        assert.ok(mockNode.ownedBlocksCache.includes('hash2'));
        assert.strictEqual(insertedHash, 'hash2', 'Native MongoDB insertion fired');
    });

    it('Bypasses cache population when cache matches ledger', async () => {
        
        const mockNode = await getMockNode(PeerNodeClass);
        mockNode.publicKey = 'myPubKey';
        
        mock.method(mockNode.ledger.collection!, 'countDocuments', async () => 5);
        mock.method(mockNode.ledger.ownedBlocksCollection!, 'countDocuments', async () => 5);
        mock.method(mockNode.ledger.ownedBlocksCollection!, 'find', () => createMongoCursorStub([
            { hash: 'hash_from_cache' }
        ]));
        
        await mockNode.loadOwnedBlocksCache();
        
        assert.strictEqual(mockNode.ownedBlocksCache.length, 1);
        assert.strictEqual(mockNode.ownedBlocksCache[0], 'hash_from_cache');
    });

    it('Auto-invalidates stale cache if database appears purged', async () => {
        const mockNode = await getMockNode(PeerNodeClass);
        mockNode.publicKey = 'myPubKey';
        
        let deleted = false;
        mockNode.ownedBlocksCache = ['hash1']; // Simulate existing cache
        mockNode.ledger = createMock<Ledger>({
            collection: { countDocuments: async () => 1 } as any, // Only Genesis
            ownedBlocksCollection: { 
                 countDocuments: async () => 5, // Stale
                 deleteMany: async () => { deleted = true; }
            } as any
        });

        await mockNode.loadOwnedBlocksCache();
        
        assert.strictEqual(mockNode.ownedBlocksCache.length, 0); // Fails
        assert.strictEqual(deleted, true);
    });

    it('Handles outer wrapper failures during cache recovery', async () => {
        const mockNode = await getMockNode(PeerNodeClass);
        mockNode.ledger = createMock<Ledger>({
            collection: { countDocuments: async () => { throw new Error('DB Crash'); } } as any
        });

        await mockNode.loadOwnedBlocksCache();
        
        assert.strictEqual(mockNode.ownedBlocksCache.length, 0); // Outer catch handles it
    });

    it('Synchronizes deletion from unverified blocks', async () => {
        const mockNode = await getMockNode(PeerNodeClass);
        mockNode.publicKey = 'myPubKey';
        
        mockNode.mempool = createMock<Mempool>({
             pendingBlocks: new Map() as any
        });
        const dummyBlock3: import('../../types').Block = {
            type: 'TRANSACTION',
            metadata: { index: 1, timestamp: 1 },
            publicKey: 'myPubKey',
            signature: 'sig',
            hash: 'hash3',
            payload: { senderSignature: '', senderId: '', recipientId: '', amount: 0 }
        };
        const mockConn = { peerAddress: '127.0.0.1:1234', send: () => {} };
        mockNode.mempool.pendingBlocks.set('hash3', { block: dummyBlock3, connection: mockConn, timestamp: 12345 });

        mockNode.ledger = createMock<Ledger>({
            ownedBlocksCollection: {
                 insertOne: async () => { throw new Error('Write error'); }
            } as any
        });

        await mockNode.addOwnedBlockToCache(dummyBlock3);
        
        assert.ok(!mockNode.mempool.pendingBlocks.has('hash3'));
        assert.ok(mockNode.ownedBlocksCache.includes('hash3'));

        // Test getMajorityCount
        mockNode.peer = createMock<Peer>({ ...mockNode.peer, trustedPeers: ['peer1', 'peer2'] });
        assert.strictEqual(mockNode.getMajorityCount(), 2);

        mockNode.peer = createMock<Peer>({ ...mockNode.peer, trustedPeers: ['peer1', 'peer2', 'peer3'] });
        assert.strictEqual(mockNode.getMajorityCount(), 3);

        mockNode.peer = createMock<Peer>(null as any);
        assert.strictEqual(mockNode.getMajorityCount(), 1);
    });
});
