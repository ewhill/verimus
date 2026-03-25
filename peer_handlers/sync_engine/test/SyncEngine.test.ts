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
        const mockConnection: import('../../../types').PeerConnection = {
            peerAddress: 'mock',
            send: (msg: any) => { sentMessage = msg; }
        };
        await syncEngine.handleChainStatusRequest(mockConnection);
        assert.ok(sentMessage !== null);
        assert.strictEqual(sentMessage instanceof ChainStatusResponseMessage, true);
        assert.strictEqual(sentMessage.latestIndex, 5);
        assert.strictEqual(sentMessage.latestHash, 'latestHash123');
    });

    it('Evaluates chain status pointers and peer heights', async () => {
        syncEngine.isSyncing = true;
        const mockConnection: import('../../../types').PeerConnection = { peerAddress: '127.0.0.1:3001', send: () => {} };
        await syncEngine.handleChainStatusResponse(10, 'remoteHash', mockConnection);
        assert.strictEqual(syncEngine._chainStatusResponses.length, 1);
        assert.strictEqual(syncEngine._chainStatusResponses[0].latestIndex, 10);
        assert.strictEqual(syncEngine._chainStatusResponses[0].latestHash, 'remoteHash');
    });

    it('Maps requested block records for remote peers', async () => {
        let sentMessage: any = null;
        const mockConnection: import('../../../types').PeerConnection = {
            peerAddress: 'mock',
            send: (msg: any) => { sentMessage = msg; }
        };
        await syncEngine.handleBlockSyncRequest(2, mockConnection);
        assert.ok(sentMessage !== null);
        // It should match the mock mapped correctly successfully
        assert.strictEqual(sentMessage instanceof BlockSyncResponseMessage, true);
        assert.strictEqual(sentMessage.block.hash, 'block2Hash');
    });

    it('Archives remotely retrieved blocks to ledger', async () => {
        syncEngine.isSyncing = true;
        const mockBlock: any = { metadata: { index: 12 }, hash: 'newHash12' };
        const mockConnection: import('../../../types').PeerConnection = { peerAddress: '127.0.0.1:3001', send: () => {} };
        // @ts-ignore
        await syncEngine.handleBlockSyncResponse(mockBlock, mockConnection);
        assert.strictEqual(syncEngine._blockSyncResponses.size, 1);
        const buffered = syncEngine._blockSyncResponses.get('12_127.0.0.1:3001');
        assert.strictEqual(buffered?.hash, 'newHash12');
    });

    it('Drops unsolicited block responses', async () => {
        syncEngine.isSyncing = false;
        const mockBlock: any = { metadata: { index: 12 }, hash: 'newHash12' };
        const mockConnection: import('../../../types').PeerConnection = { peerAddress: '127.0.0.1:3001', send: () => {} };
        // @ts-ignore
        await syncEngine.handleBlockSyncResponse(mockBlock, mockConnection);
        assert.strictEqual(syncEngine._blockSyncResponses.size, 0);
    });

    it('Coordinates initial chain retrievals', async () => {
        mockNode.peer.broadcast = async () => { };
        mockNode.ledger.isChainValid = async () => true;

        // let _sentReq = false;
        const mockConn1: import('../../../types').PeerConnection = {
            peerAddress: 'addr1',
            send: (_unusedM: any) => {}
        };

        const originalSetTimeout = global.setTimeout;
        // @ts-ignore
        (global).setTimeout = (cb: any, _unusedMs: any) => { cb(); return {}; };

        // Feed mock responses
        syncEngine._chainStatusResponses = [
            { latestIndex: 10, latestHash: 'h10', connection: mockConn1 }
        ];

        mockNode.ledger.getLatestBlock = async () => ({ metadata: { index: 9 }, hash: 'h9', previousHash: 'h8' });

        const mockNewBlock = { hash: 'h10', previousHash: 'h9', metadata: { index: 10 } };
        // We need cryptoUtils to return h10

        const origHashData = cryptoUtils.hashData;
        // @ts-ignore
        (cryptoUtils).hashData = () => 'h10';

        // @ts-ignore
        syncEngine._blockSyncResponses.set('10_addr1', mockNewBlock);
        // let blockAdded = false;
        mockNode.ledger.addBlockToChain = async (_unusedB: any) => {};

        await syncEngine.performInitialSync();

        // @ts-ignore
        (cryptoUtils).hashData = origHashData;
        global.setTimeout = originalSetTimeout;

        assert.strictEqual(syncEngine.isSyncing, false);
    });

    it('Rejects arrays with hash inconsistencies', async () => {
        mockNode.peer.broadcast = async () => { };

        // Simulating corrupted local chain conceptually
        mockNode.ledger.isChainValid = async () => false;

        let purged = false;
        mockNode.ledger.purgeChain = async () => { purged = true; };

        const mockConn1: import('../../../types').PeerConnection = {
            peerAddress: 'addr1',
            send: (_unusedM: any) => { }
        };

        syncEngine._chainStatusResponses = [
            { latestIndex: 10, latestHash: 'h10', connection: mockConn1 }
        ];

        let indexCallCount = 0;
        mockNode.ledger.getLatestBlock = async () => {
            indexCallCount++;
            if (indexCallCount === 1) return { metadata: { index: 9 }, hash: 'h9' };
            return { metadata: { index: 0 }, hash: 'h0' };
        };

        const originalSetTimeout = global.setTimeout;
        // @ts-ignore
        (global).setTimeout = (cb: any, _unusedMs: any) => {
            syncEngine._chainStatusResponses = [
                { latestIndex: 10, latestHash: 'h10', connection: mockConn1 }
            ];
            // @ts-ignore
            syncEngine.syncBuffer = [
                { type: 'PendingBlock', block: {} as unknown as import('../../../types').Block, connection: mockConn1, timestamp: 123 },
                { type: 'AdoptFork', forkId: 'f1', finalTipHash: 'h1', connection: mockConn1 }
            ];
            cb();
            return {};
        };

        // Buffer queue handling
        // let _pbHandled = false;
        // let _afHandled = false;
        mockNode.consensusEngine = {
            handlePendingBlock: async () => {},
            handleAdoptFork: async () => {}
        };

        await syncEngine.performInitialSync();

        assert.ok(purged); // The purge should have happened
        // The early return when > triggers, so buffer isn't handled here.

        global.setTimeout = originalSetTimeout;
    });

    it('Evaluates sync buffer sequentially', async () => {
        mockNode.peer.broadcast = async () => { };
        mockNode.ledger.isChainValid = async () => true;

        const mockConn1: import('../../../types').PeerConnection = { peerAddress: 'addr1', send: (_unusedM: any) => { } };
        syncEngine._chainStatusResponses = [{ latestIndex: 10, latestHash: 'h10', connection: mockConn1 }];
        mockNode.ledger.getLatestBlock = async () => ({ metadata: { index: 10 }, hash: 'h10' });

        let pbHandled = false;
        let afHandled = false;
        mockNode.consensusEngine = {
            handlePendingBlock: async () => { pbHandled = true; },
            handleAdoptFork: async () => { afHandled = true; }
        };

        const originalSetTimeout = global.setTimeout;
        // @ts-ignore
        (global).setTimeout = (cb: any, _unusedMs: any) => {
            syncEngine._chainStatusResponses = [{ latestIndex: 10, latestHash: 'h10', connection: mockConn1 }];
            // @ts-ignore
            syncEngine.syncBuffer = [
                { type: 'PendingBlock', block: {} as unknown as import('../../../types').Block, connection: mockConn1, timestamp: 123 },
                { type: 'AdoptFork', forkId: 'f1', finalTipHash: 'h1', connection: mockConn1 }
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

        const mockConn1: import('../../../types').PeerConnection = { peerAddress: 'addr1', send: () => { } };
        const mockConn2: import('../../../types').PeerConnection = { peerAddress: 'addr2', send: () => { } };

        const originalSetTimeout = global.setTimeout;
        // @ts-ignore
        (global).setTimeout = (cb: any, _unusedMs: any) => {
            // set responses inside mock
            syncEngine._chainStatusResponses = [
                { latestIndex: 1, latestHash: 'h1', connection: mockConn1 },
                { latestIndex: 1, latestHash: 'h1', connection: mockConn2 }
            ];
            // @ts-ignore
            syncEngine._blockSyncResponses.set('1_addr1', { hash: 'block1' });
            // @ts-ignore
            syncEngine._blockSyncResponses.set('1_addr2', { hash: 'block-diff' });
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

        const mockConn1: import('../../../types').PeerConnection = { peerAddress: 'addr1', send: () => { } };


        const origHash = cryptoUtils.hashData;

        const computedHash1 = origHash(JSON.stringify({ metadata: { index: 1 }, previousHash: 'h0' }));

        const originalSetTimeout = global.setTimeout;
        // @ts-ignore
        (global).setTimeout = (cb: any, _unusedMs: any) => {
            syncEngine._chainStatusResponses = [
                { latestIndex: 2, latestHash: 'h2', connection: mockConn1 }
            ];
            // Valid block for index 1
            // @ts-ignore
            syncEngine._blockSyncResponses.set('1_addr1', { metadata: { index: 1 }, previousHash: 'h0', hash: computedHash1 });
            // Invalid block for index 2
            // @ts-ignore
            syncEngine._blockSyncResponses.set('2_addr1', { metadata: { index: 2 }, previousHash: 'h1', hash: 'invalidHash' });
            cb(); return {};
        };

        await syncEngine.performInitialSync();
        global.setTimeout = originalSetTimeout;
        // @ts-ignore
        (cryptoUtils).hashData = origHash;

        assert.strictEqual(syncEngine.isSyncing, false);
        assert.strictEqual(addedCount, 1);
    });

    it('Broadcasts limit orders and successfully maps required bids', async () => {
        // let _sentMessage: any = null;
        mockNode.peer.broadcast = async (_unusedMsg: any) => { };

        // Let orchestrate storage market run, but we will fulfill the market manually simulating the network
        const promise = syncEngine.orchestrateStorageMarket('req-1', 1000, 250, 2, 0.10);

        // Before timeout, manually ingest 2 bids
        const market = syncEngine.activeStorageMarkets.get('req-1');
        assert.ok(market);

        // @ts-ignore
        await syncEngine.handleStorageBid({ storageRequestId: 'req-1', storageHostId: 'host-1', proposedCostPerGB: 0.05, guaranteedUptimeMs: 1 }, {});
        // @ts-ignore
        await syncEngine.handleStorageBid({ storageRequestId: 'req-1', storageHostId: 'host-2', proposedCostPerGB: 0.08, guaranteedUptimeMs: 1 }, {});

        const result = await promise;
        assert.strictEqual(result.length, 2);
        assert.strictEqual(syncEngine.activeStorageMarkets.has('req-1'), false);
    });

    it('Ignores storage requests if role is not STORAGE', async () => {
        let sentMessage: any = null;
        const mockConnection: import('../../../types').PeerConnection = { peerAddress: 'mock', send: (msg: any) => { sentMessage = msg; } };

        mockNode.roles = ['ORIGINATOR'];
        // @ts-ignore
        await syncEngine.handleStorageRequest({ storageRequestId: 'r-2', senderId: 'remote', maxCostPerGB: 0.10 }, mockConnection);

        assert.strictEqual(sentMessage, null);

        mockNode.roles = ['STORAGE'];
        mockNode.publicKey = 'local-storage';
        mockNode.storageProvider = { getEgressCostPerGB: () => 0.05 };

        // @ts-ignore
        await syncEngine.handleStorageRequest({ storageRequestId: 'r-2', senderId: 'remote', maxCostPerGB: 0.10 }, mockConnection);
        assert.ok(sentMessage !== null);
        // @ts-ignore
        assert.strictEqual(sentMessage.proposedCostPerGB, 0.05);

        // Tests dropping requests when internal limit mappings exceed ceiling
        sentMessage = null;
        // @ts-ignore
        await syncEngine.handleStorageRequest({ storageRequestId: 'r-3', senderId: 'remote', maxCostPerGB: 0.01 }, mockConnection);
        assert.strictEqual(sentMessage, null);
    });

    it('Triage timeout drops expired orders returning gathered bids', async () => {
        mockNode.peer.broadcast = async () => { };
        const originalSetTimeout = global.setTimeout;

        // Mock setTimeout to immediately execute preventing async drift
        // @ts-ignore
        (global).setTimeout = (cb: any, _unusedMs: any) => { cb(); return {}; };

        const promise = syncEngine.orchestrateStorageMarket('req-timeout', 1000, 250, 5, 0.10);

        // Inject 1 partial bid mapping
        const market = syncEngine.activeStorageMarkets.get('req-timeout');
        // @ts-ignore
        market?.bids.push({ peerId: 'host-1', cost: 0.05, uptime: 10, connection: {} });

        const result = await promise;
        assert.strictEqual(result.length, 1);
        assert.strictEqual(syncEngine.activeStorageMarkets.has('req-timeout'), false);

        global.setTimeout = originalSetTimeout;
    });
});
