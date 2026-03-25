import assert from 'node:assert';
import { describe, it, beforeEach } from 'node:test';

import * as cryptoUtils from '../../../crypto_utils/CryptoUtils';
import { BlockSyncResponseMessage } from '../../../messages/block_sync_response_message/BlockSyncResponseMessage';
import { ChainStatusResponseMessage } from '../../../messages/chain_status_response_message/ChainStatusResponseMessage';
import SyncEngine from '../SyncEngine';

describe('Backend: SyncEngine Integrity', () => {
    let mockNode: any;
    let syncEngine: SyncEngine;

    beforeEach(() => {
        mockNode = {
            port: 3000,
            ledger: {
                getLatestBlock: async () => ({ metadata: { index: 5 }, hash: 'latestHash123' }),
                getBlockByIndex: async (index: number) => {
                    if (index === 2) return { metadata: { index: 2 }, hash: 'block2Hash' };
                    return null;
                }
            },
            peer: {
                trustedPeers: ['127.0.0.1:3001'],
                bind: () => ({ to: () => { } }),
                broadcast: async () => { }
            }
        };
        syncEngine = new SyncEngine(mockNode);
    });

    it('Initializes and exports module', () => {
        assert.ok(SyncEngine !== undefined, 'Module loaded successfully');
    });

    it('Responds with ledger height on status requests', async () => {
        let sentMessage: any = null;
        const mockConnection = {
            send: (msg: any) => { sentMessage = msg; }
        };
        await syncEngine.handleChainStatusRequest(mockConnection as any);
        assert.ok(sentMessage !== null);
        assert.strictEqual(sentMessage instanceof ChainStatusResponseMessage, true);
        assert.strictEqual(sentMessage.latestIndex, 5);
        assert.strictEqual(sentMessage.latestHash, 'latestHash123');
    });

    it('Evaluates chain status pointers and peer heights', async () => {
        syncEngine.isSyncing = true;
        const mockConnection = { peerAddress: '127.0.0.1:3001' };
        await syncEngine.handleChainStatusResponse(10, 'remoteHash', mockConnection as any);
        assert.strictEqual(syncEngine._chainStatusResponses.length, 1);
        assert.strictEqual(syncEngine._chainStatusResponses[0].latestIndex, 10);
        assert.strictEqual(syncEngine._chainStatusResponses[0].latestHash, 'remoteHash');
    });

    it('Maps requested block records for remote peers', async () => {
        let sentMessage: any = null;
        const mockConnection = {
            send: (msg: any) => { sentMessage = msg; }
        };
        await syncEngine.handleBlockSyncRequest(2, mockConnection as any);
        assert.ok(sentMessage !== null);
        // It should match the mock mapped correctly successfully
        assert.strictEqual(sentMessage instanceof BlockSyncResponseMessage, true);
        assert.strictEqual(sentMessage.block.hash, 'block2Hash');
    });

    it('Archives remotely retrieved blocks to ledger', async () => {
        syncEngine.isSyncing = true;
        const mockBlock: any = { metadata: { index: 12 }, hash: 'newHash12' };
        const mockConnection = { peerAddress: '127.0.0.1:3001' };
        await syncEngine.handleBlockSyncResponse(mockBlock, mockConnection as any);
        assert.strictEqual(syncEngine._blockSyncResponses.size, 1);
        const buffered = syncEngine._blockSyncResponses.get('12_127.0.0.1:3001');
        assert.strictEqual(buffered?.hash, 'newHash12');
    });

    it('Drops unsolicited block responses', async () => {
        syncEngine.isSyncing = false;
        const mockBlock: any = { metadata: { index: 12 }, hash: 'newHash12' };
        const mockConnection = { peerAddress: '127.0.0.1:3001' };
        await syncEngine.handleBlockSyncResponse(mockBlock, mockConnection as any);
        assert.strictEqual(syncEngine._blockSyncResponses.size, 0);
    });

    it('Coordinates initial chain retrievals', async () => {
        mockNode.peer.broadcast = async () => { };
        mockNode.ledger.isChainValid = async () => true;

        let sentReq = false;
        const mockConn1 = {
            peerAddress: 'addr1',
            send: (m: any) => { sentReq = true; }
        };

        const originalSetTimeout = global.setTimeout;
        (global as any).setTimeout = (cb: any, ms: any) => { cb(); return {} as any; };

        // Feed mock responses
        syncEngine._chainStatusResponses = [
            { latestIndex: 10, latestHash: 'h10', connection: mockConn1 as any }
        ];

        mockNode.ledger.getLatestBlock = async () => ({ metadata: { index: 9 }, hash: 'h9', previousHash: 'h8' });

        const mockNewBlock = { hash: 'h10', previousHash: 'h9', metadata: { index: 10 } };
        // We need cryptoUtils to return h10

        const origHashData = cryptoUtils.hashData;
        (cryptoUtils as any).hashData = () => 'h10';

        syncEngine._blockSyncResponses.set('10_addr1', mockNewBlock as any);
        let blockAdded = false;
        mockNode.ledger.addBlockToChain = async (_b: any) => { blockAdded = true; };

        await syncEngine.performInitialSync();

        (cryptoUtils as any).hashData = origHashData;
        global.setTimeout = originalSetTimeout;

        assert.strictEqual(syncEngine.isSyncing, false);
    });

    it('Rejects arrays with hash inconsistencies', async () => {
        mockNode.peer.broadcast = async () => { };

        // Simulating corrupted local chain conceptually
        mockNode.ledger.isChainValid = async () => false;

        let purged = false;
        mockNode.ledger.purgeChain = async () => { purged = true; };

        const mockConn1 = {
            peerAddress: 'addr1',
            send: (_m: any) => { }
        };

        syncEngine._chainStatusResponses = [
            { latestIndex: 10, latestHash: 'h10', connection: mockConn1 as any }
        ];

        let indexCallCount = 0;
        mockNode.ledger.getLatestBlock = async () => {
            indexCallCount++;
            if (indexCallCount === 1) return { metadata: { index: 9 }, hash: 'h9' };
            return { metadata: { index: 0 }, hash: 'h0' };
        };

        const originalSetTimeout = global.setTimeout;
        (global as any).setTimeout = (cb: any, _ms: any) => {
            syncEngine._chainStatusResponses = [
                { latestIndex: 10, latestHash: 'h10', connection: mockConn1 as any }
            ];
            syncEngine.syncBuffer = [
                { type: 'PendingBlock', block: {} as any, connection: mockConn1 as any, timestamp: 123 },
                { type: 'AdoptFork', forkId: 'f1', finalTipHash: 'h1', connection: mockConn1 as any }
            ];
            cb();
            return {};
        };

        // Buffer queue handling
        let pbHandled = false;
        let afHandled = false;
        mockNode.consensusEngine = {
            handlePendingBlock: async () => { pbHandled = true; },
            handleAdoptFork: async () => { afHandled = true; }
        };

        await syncEngine.performInitialSync();

        assert.ok(purged); // The purge should have happened
        // The early return when > triggers, so buffer isn't handled here.

        global.setTimeout = originalSetTimeout;
    });

    it('Evaluates sync buffer sequentially', async () => {
        mockNode.peer.broadcast = async () => { };
        mockNode.ledger.isChainValid = async () => true;

        const mockConn1 = { peerAddress: 'addr1', send: (_m: any) => { } };
        syncEngine._chainStatusResponses = [{ latestIndex: 10, latestHash: 'h10', connection: mockConn1 as any }];
        mockNode.ledger.getLatestBlock = async () => ({ metadata: { index: 10 }, hash: 'h10' });

        let pbHandled = false;
        let afHandled = false;
        mockNode.consensusEngine = {
            handlePendingBlock: async () => { pbHandled = true; },
            handleAdoptFork: async () => { afHandled = true; }
        };

        const originalSetTimeout = global.setTimeout;
        (global as any).setTimeout = (cb: any, _ms: any) => {
            syncEngine._chainStatusResponses = [{ latestIndex: 10, latestHash: 'h10', connection: mockConn1 as any }];
            syncEngine.syncBuffer = [
                { type: 'PendingBlock', block: {} as any, connection: mockConn1 as any, timestamp: 123 },
                { type: 'AdoptFork', forkId: 'f1', finalTipHash: 'h1', connection: mockConn1 as any }
            ];
            cb();
            return {};
        };

        await syncEngine.performInitialSync();
        global.setTimeout = originalSetTimeout;
        assert.ok(pbHandled);
        assert.ok(afHandled);
    });

    it('Resolves race conditions during host collisions', async () => {
        mockNode.peer.broadcast = async () => { };
        mockNode.ledger.isChainValid = async () => true;
        mockNode.ledger.getLatestBlock = async () => ({ metadata: { index: 0 }, hash: 'h0' });
        mockNode.ledger.addBlockToChain = async () => { };

        const mockConn1 = { peerAddress: 'addr1', send: () => { } };
        const mockConn2 = { peerAddress: 'addr2', send: () => { } };

        const originalSetTimeout = global.setTimeout;
        (global as any).setTimeout = (cb: any, _ms: any) => {
            // set responses inside mock
            syncEngine._chainStatusResponses = [
                { latestIndex: 1, latestHash: 'h1', connection: mockConn1 as any },
                { latestIndex: 1, latestHash: 'h1', connection: mockConn2 as any }
            ];
            // Set up mismatch between main and secondary
            syncEngine._blockSyncResponses.set('1_addr1', { hash: 'block1' } as any);
            syncEngine._blockSyncResponses.set('1_addr2', { hash: 'block-diff' } as any);
            cb(); return {};
        };

        await syncEngine.performInitialSync();
        global.setTimeout = originalSetTimeout;
        assert.strictEqual(syncEngine.isSyncing, false);
    });

    it('Drops blocks with hash integrity faults', async () => {
        mockNode.peer.broadcast = async () => { };
        mockNode.ledger.isChainValid = async () => true;
        mockNode.ledger.getLatestBlock = async () => ({ metadata: { index: 0 }, hash: 'h0' });

        let addedCount = 0;
        let currentInd = 0;
        mockNode.ledger.getLatestBlock = async () => ({ metadata: { index: currentInd }, hash: `h${currentInd}` });
        mockNode.ledger.addBlockToChain = async () => { addedCount++; currentInd++; };

        const mockConn1 = { peerAddress: 'addr1', send: () => { } };


        const origHash = cryptoUtils.hashData;

        const computedHash1 = origHash(JSON.stringify({ metadata: { index: 1 }, previousHash: 'h0' }));

        const originalSetTimeout = global.setTimeout;
        (global as any).setTimeout = (cb: any, _ms: any) => {
            syncEngine._chainStatusResponses = [
                { latestIndex: 2, latestHash: 'h2', connection: mockConn1 as any }
            ];
            // Valid block for index 1
            syncEngine._blockSyncResponses.set('1_addr1', { metadata: { index: 1 }, previousHash: 'h0', hash: computedHash1 } as any);
            // Invalid block for index 2
            syncEngine._blockSyncResponses.set('2_addr1', { metadata: { index: 2 }, previousHash: 'h1', hash: 'invalidHash' } as any);
            cb(); return {};
        };

        await syncEngine.performInitialSync();
        global.setTimeout = originalSetTimeout;
        (cryptoUtils as any).hashData = origHash;

        assert.strictEqual(syncEngine.isSyncing, false);
        assert.strictEqual(addedCount, 1);
    });

    it('Broadcasts limit orders and successfully maps required bids', async () => {
        let sentMessage: any = null;
        mockNode.peer.broadcast = async (msg: any) => { sentMessage = msg; };

        // Let orchestrate storage market run, but we will fulfill the market manually simulating the network
        const promise = syncEngine.orchestrateStorageMarket('req-1', 1000, 250, 2, 0.10);

        // Before timeout, manually ingest 2 bids
        const market = syncEngine.activeStorageMarkets.get('req-1');
        assert.ok(market);

        await syncEngine.handleStorageBid({ storageRequestId: 'req-1', storageHostId: 'host-1', proposedCostPerGB: 0.05, guaranteedUptimeMs: 1 } as any, {} as any);
        await syncEngine.handleStorageBid({ storageRequestId: 'req-1', storageHostId: 'host-2', proposedCostPerGB: 0.08, guaranteedUptimeMs: 1 } as any, {} as any);

        const result = await promise;
        assert.strictEqual(result.length, 2);
        assert.strictEqual(syncEngine.activeStorageMarkets.has('req-1'), false);
    });

    it('Ignores storage requests if role is not STORAGE', async () => {
        let sentMessage: any = null;
        const mockConnection = { send: (msg: any) => { sentMessage = msg; } };

        mockNode.roles = ['ORIGINATOR'];
        await syncEngine.handleStorageRequest({ storageRequestId: 'r-2', senderId: 'remote', maxCostPerGB: 0.10 } as any, mockConnection as any);

        assert.strictEqual(sentMessage, null);

        mockNode.roles = ['STORAGE'];
        mockNode.publicKey = 'local-storage';
        mockNode.storageProvider = { getEgressCostPerGB: () => 0.05 };

        await syncEngine.handleStorageRequest({ storageRequestId: 'r-2', senderId: 'remote', maxCostPerGB: 0.10 } as any, mockConnection as any);
        assert.ok(sentMessage !== null);
        assert.strictEqual((sentMessage as any).proposedCostPerGB, 0.05);

        // Tests dropping requests when internal limit mappings exceed ceiling
        sentMessage = null;
        await syncEngine.handleStorageRequest({ storageRequestId: 'r-3', senderId: 'remote', maxCostPerGB: 0.01 } as any, mockConnection as any);
        assert.strictEqual(sentMessage, null);
    });

    it('Triage timeout drops expired orders returning gathered bids', async () => {
        mockNode.peer.broadcast = async () => { };
        const originalSetTimeout = global.setTimeout;

        // Mock setTimeout to immediately execute preventing async drift
        (global as any).setTimeout = (cb: any, _ms: any) => { cb(); return {} as any; };

        const promise = syncEngine.orchestrateStorageMarket('req-timeout', 1000, 250, 5, 0.10);

        // Inject 1 partial bid mapping
        const market = syncEngine.activeStorageMarkets.get('req-timeout');
        market?.bids.push({ peerId: 'host-1', cost: 0.05, uptime: 10, connection: {} as any });

        const result = await promise;
        assert.strictEqual(result.length, 1);
        assert.strictEqual(syncEngine.activeStorageMarkets.has('req-timeout'), false);

        global.setTimeout = originalSetTimeout;
    });
});
