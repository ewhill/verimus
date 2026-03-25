import assert from 'node:assert';
import * as fs from 'node:fs';
import { describe, it } from 'node:test';

import type Bundler from '../../bundler/Bundler';
import type { PeerCredentials } from '../../credential_provider/CredentialProvider';
import type Ledger from '../../ledger/Ledger';
import type Mempool from '../../models/mempool/Mempool';
import type { Peer } from '../../p2p';
import type BaseProvider from '../../storage_providers/base_provider/BaseProvider';

describe('Backend: PeerNode Logical Verification Check', () => {

    it('Initializes standard P2P Express configurations', async () => {
        const mod = await import('../PeerNode');
        assert.ok(mod !== undefined, 'PeerNode structure correctly parses TS mapping modules');
        assert.ok(mod.default !== undefined, 'PeerNode surfaces default instantiator');
    });

    it('Instantiates ReputationManager mapped to the database', async () => {
        const PeerNode = (await import('../PeerNode')).default;
        
        const mockNode = new PeerNode(3002, [], undefined as unknown as BaseProvider, undefined as unknown as Bundler, 'mongodb://localhost:27017/test', undefined as unknown as string, {} as unknown as PeerCredentials, 'data');
        mockNode.ledger = {
            init: async () => {}, collection: {}, events: { on: () => {} }, peersCollection: { testMarker: true } 
        } as unknown as Ledger;
        
        mockNode.loadOwnedBlocksCache = async () => {};
        
        // Mock fs to bypass internal syncs

        const origReadFileSync = fs.readFileSync;
        (fs as unknown as { readFileSync: Function }).readFileSync = () => Buffer.from('MOCK_KEY');

        try {
           await mockNode.init().catch(e => {}); // Only care about internal instantiation sequence
        } catch(e) {}

        assert.ok(mockNode.reputationManager !== undefined, 'ReputationManager MUST exist post-initialization');
        assert.ok((mockNode.reputationManager as unknown as Record<string, any>).peersCollection.testMarker, 'ReputationManager bridged native persistent Mongo DB Collections');

        (fs as unknown as { readFileSync: Function }).readFileSync = origReadFileSync;
    });

    it('Restores block caching arrays on initialization from MongoDB', async () => {
        const PeerNode = (await import('../PeerNode')).default;
        
        const mockNode = new PeerNode(3002, [], undefined as unknown as BaseProvider, undefined as unknown as Bundler, 'mongodb://localhost:27017/test', undefined as unknown as string, {} as unknown as PeerCredentials, 'data');
        mockNode.publicKey = 'myPubKey';
        mockNode.ledger = {
            collection: {
                 countDocuments: async () => 5,
                 find: () => ({ toArray: async () => [{ hash: 'hash1', publicKey: 'myPubKey' }] })
            },
            ownedBlocksCollection: {
                 countDocuments: async () => 0, // Force migration path
                 insertMany: async () => {}
            }
        } as unknown as Ledger;

        await mockNode.loadOwnedBlocksCache();
        
        assert.strictEqual(mockNode.ownedBlocksCache.length, 1);
        assert.strictEqual(mockNode.ownedBlocksCache[0], 'hash1');
    });

    it('Adds newly owned blocks directly to MongoDB correctly', async () => {
        const PeerNode = (await import('../PeerNode')).default;
        
        const mockNode = new PeerNode(3002, [], undefined as unknown as BaseProvider, undefined as unknown as Bundler, 'mongodb://localhost:27017/test', undefined as unknown as string, {} as unknown as PeerCredentials, 'data');
        mockNode.publicKey = 'myPubKey';
        mockNode.ownedBlocksCache = [];
        
        mockNode.mempool = {
             pendingBlocks: new Map()
        } as unknown as Mempool;

        let insertedHash = '';
        mockNode.ledger = {
            ownedBlocksCollection: {
                 insertOne: async (doc: any) => { insertedHash = doc.hash; }
            }
        } as unknown as Ledger;

        await mockNode.addOwnedBlockToCache({ hash: 'hash2', publicKey: 'myPubKey' } as unknown as any);
        
        assert.strictEqual(mockNode.ownedBlocksCache.length, 1);
        assert.ok(mockNode.ownedBlocksCache.includes('hash2'));
        assert.strictEqual(insertedHash, 'hash2', 'Native MongoDB insertion fired');
    });

    it('Bypasses cache population when cache matches ledger', async () => {
        const PeerNode = (await import('../PeerNode')).default;
        
        const mockNode = new PeerNode(3002, [], undefined as unknown as BaseProvider, undefined as unknown as Bundler, 'mongodb://localhost:27017/test', undefined as unknown as string, {} as unknown as PeerCredentials, 'data');
        mockNode.publicKey = 'myPubKey';
        mockNode.ledger = {
            collection: { countDocuments: async () => 5 },
            ownedBlocksCollection: { 
                 countDocuments: async () => 1,
                 find: () => ({ toArray: async () => [{ hash: 'hash_from_cache' }] })
            }
        } as unknown as Ledger;
        
        await mockNode.loadOwnedBlocksCache();
        
        assert.strictEqual(mockNode.ownedBlocksCache.length, 1);
        assert.strictEqual(mockNode.ownedBlocksCache[0], 'hash_from_cache');
    });

    it('Auto-invalidates stale cache if database appears purged', async () => {
        const PeerNode = (await import('../PeerNode')).default;
        
        const mockNode = new PeerNode(3002, [], undefined as unknown as BaseProvider, undefined as unknown as Bundler, 'mongodb://localhost:27017/test', undefined as unknown as string, {} as unknown as PeerCredentials, 'data');
        mockNode.publicKey = 'myPubKey';
        
        let deleted = false;
        mockNode.ledger = {
            collection: { countDocuments: async () => 1 }, // Only Genesis
            ownedBlocksCollection: { 
                 countDocuments: async () => 5, // Stale
                 deleteMany: async () => { deleted = true; }
            }
        } as unknown as Ledger;

        await mockNode.loadOwnedBlocksCache();
        
        assert.strictEqual(mockNode.ownedBlocksCache.length, 0); // Fails
        assert.strictEqual(deleted, true);
    });

    it('Handles outer wrapper failures during cache recovery', async () => {
        const PeerNode = (await import('../PeerNode')).default;
        
        const mockNode = new PeerNode(3002, [], undefined as unknown as BaseProvider, undefined as unknown as Bundler, 'mongodb://localhost:27017/test', undefined as unknown as string, {} as unknown as PeerCredentials, 'data');
        mockNode.ledger = {
            collection: { countDocuments: async () => { throw new Error('DB Crash'); } }
        } as unknown as Ledger;

        await mockNode.loadOwnedBlocksCache();
        
        assert.strictEqual(mockNode.ownedBlocksCache.length, 0); // Outer catch handles it
    });

    it('Synchronizes deletion from unverified blocks', async () => {
        const PeerNode = (await import('../PeerNode')).default;
        
        const mockNode = new PeerNode(3002, [], undefined as unknown as BaseProvider, undefined as unknown as Bundler, 'mongodb://localhost:27017/test', undefined as unknown as string, {} as unknown as PeerCredentials, 'data');
        mockNode.publicKey = 'myPubKey';
        mockNode.ownedBlocksCache = [];
        
        mockNode.mempool = {
             pendingBlocks: new Map()
        } as unknown as Mempool;
        mockNode.mempool.pendingBlocks.set('hash3', { hash: 'hash3' } as unknown as any);

        mockNode.ledger = {
            ownedBlocksCollection: {
                 insertOne: async () => { throw new Error('Write error'); }
            }
        } as unknown as Ledger;

        await mockNode.addOwnedBlockToCache({ hash: 'hash3', publicKey: 'myPubKey' } as unknown as any);
        
        assert.ok(!mockNode.mempool.pendingBlocks.has('hash3'));
        assert.ok(mockNode.ownedBlocksCache.includes('hash3'));

        // Test getMajorityCount
        mockNode.peer = { ...mockNode.peer, trustedPeers: ['peer1', 'peer2'] } as unknown as Peer;
        assert.strictEqual(mockNode.getMajorityCount(), 2);

        mockNode.peer = { ...mockNode.peer, trustedPeers: ['peer1', 'peer2', 'peer3'] } as unknown as Peer;
        assert.strictEqual(mockNode.getMajorityCount(), 3);

        mockNode.peer = null as unknown as Peer;
        assert.strictEqual(mockNode.getMajorityCount(), 1);
    });
});
