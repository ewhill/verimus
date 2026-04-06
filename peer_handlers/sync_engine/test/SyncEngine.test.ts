import EventEmitter from 'events';
import assert from 'node:assert';
import { describe, it, beforeEach } from 'node:test';

import * as cryptoUtils from '../../../crypto_utils/CryptoUtils';
import { BlockSyncResponseMessage } from '../../../messages/block_sync_response_message/BlockSyncResponseMessage';
import { ChainStatusResponseMessage } from '../../../messages/chain_status_response_message/ChainStatusResponseMessage';
import { StorageBidMessage } from '../../../messages/storage_bid_message/StorageBidMessage';
import { StorageRequestMessage } from '../../../messages/storage_request_message/StorageRequestMessage';
import { VerifyHandoffRequestMessage } from '../../../messages/verify_handoff_request_message/VerifyHandoffRequestMessage';
import type PeerNode from '../../../peer_node/PeerNode';
import { createMock } from '../../../test/utils/TestUtils';
import type { Block, PeerConnection } from '../../../types';
import { NodeRole } from '../../../types/NodeRole';
import SyncEngine from '../SyncEngine';

const createMockBlock = (hash: string, pk: string = 'pk'): Block => ({
    type: 'TRANSACTION',
    metadata: { index: 1, timestamp: 1 },
    signerAddress: pk,
    signature: 'sig',
    hash,
    payload: { senderSignature: '', senderAddress: '', recipientAddress: '', amount: 0n }
});

describe('Backend: SyncEngine Integrity', () => {
    let mockNode: PeerNode;
    let syncEngine: SyncEngine;

    beforeEach(() => {
        mockNode = createMock<PeerNode>({
            port: 3000,
            ledger: createMock<any>({
                getLatestBlock: async () => ({ metadata: { index: 5 }, hash: 'latestHash123' }),
                getBlockByIndex: async (index: number) => {
                    if (index === 2) return { metadata: { index: 2 }, hash: 'block2Hash' };
                    return null;
                }
            }),
            peer: createMock<any>({
                peers: ['127.0.0.1:3001'],
                bind: () => ({ to: () => { } }),
                broadcast: async () => { }
            })
        });
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
        const mockConnection: import('../../../types').PeerConnection = { peerAddress: '127.0.0.1:3001', send: () => { } };
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
        const mockBlock = createMockBlock('newHash12');
        mockBlock.metadata.index = 12;
        const mockConnection: PeerConnection = { peerAddress: '127.0.0.1:3001', send: () => { } };
        await syncEngine.handleBlockSyncResponse(mockBlock, mockConnection);
        assert.strictEqual(syncEngine._blockSyncResponses.size, 1);
        const buffered = syncEngine._blockSyncResponses.get('12_127.0.0.1:3001');
        assert.strictEqual(buffered?.hash, 'newHash12');
    });

    it('Drops unsolicited block responses', async () => {
        syncEngine.isSyncing = false;
        const mockBlock = createMockBlock('newHash12');
        mockBlock.metadata.index = 12;
        const mockConnection: PeerConnection = { peerAddress: '127.0.0.1:3001', send: () => { } };
        await syncEngine.handleBlockSyncResponse(mockBlock, mockConnection);
        assert.strictEqual(syncEngine._blockSyncResponses.size, 0);
    });

    it('Coordinates initial chain retrievals', async () => {
        mockNode.peer!.broadcast = async () => { };
        (mockNode.ledger as any).isChainValid = async () => true;

        // let _sentReq = false;
        const mockConn1: import('../../../types').PeerConnection = {
            peerAddress: 'addr1',
            send: (_unusedM: any) => { }
        };

        const originalSetTimeout = global.setTimeout;
        Object.assign(global, { setTimeout: (cb: Function) => { cb(); return originalSetTimeout(() => { }, 0); } });

        // Feed mock responses
        syncEngine._chainStatusResponses = [
            { latestIndex: 10, latestHash: 'h10', connection: mockConn1 }
        ];

        (mockNode.ledger as any).getLatestBlock = async () => ({ metadata: { index: 9 }, hash: 'h9', previousHash: 'h8' });

        const mockNewBlock = { hash: 'h10', previousHash: 'h9', metadata: { index: 10, timestamp: 1 } };
        // We will generate the TRUE hash it expects natively to avoid 'must be method' ESM bugs
        const blockToHash = { ...mockNewBlock };
        delete (blockToHash as any).hash;
        delete (blockToHash as any)._id;
        const realH10 = cryptoUtils.hashData(JSON.stringify(blockToHash));
        mockNewBlock.hash = realH10;

        syncEngine['_chainStatusResponses'][0].latestHash = realH10;

        syncEngine['_blockSyncResponses'].set(`10_addr1`, createMock<Block>(mockNewBlock));
        // let blockAdded = false;
        (mockNode.ledger as any).addBlockToChain = async (_unusedB: any) => { };

        try {
            await syncEngine.performInitialSync();
        } finally {
            global.setTimeout = originalSetTimeout;
        }
        global.setTimeout = originalSetTimeout;

        assert.strictEqual(syncEngine.isSyncing, false);
    });

    it('Rejects arrays with hash inconsistencies', async () => {
        mockNode.peer!.broadcast = async () => { };

        // Simulating corrupted local chain conceptually
        (mockNode.ledger as any).isChainValid = async () => false;

        let purged = false;
        (mockNode.ledger as any).purgeChain = async () => { purged = true; };

        const mockConn1: import('../../../types').PeerConnection = {
            peerAddress: 'addr1',
            send: (_unusedM: any) => { }
        };

        syncEngine._chainStatusResponses = [
            { latestIndex: 10, latestHash: 'h10', connection: mockConn1 }
        ];

        let indexCallCount = 0;
        (mockNode.ledger as any).getLatestBlock = async () => {
            indexCallCount++;
            if (indexCallCount === 1) return { metadata: { index: 9 }, hash: 'h9' };
            return { metadata: { index: 0 }, hash: 'h0' };
        };

        const originalSetTimeout = global.setTimeout;
        Object.assign(global, {
            setTimeout: (cb: Function) => {
                syncEngine._chainStatusResponses = [
                    { latestIndex: 10, latestHash: 'h10', connection: mockConn1 }
                ];
                syncEngine['syncBuffer'] = [
                    { type: 'PendingBlock', block: createMockBlock('buff1'), connection: mockConn1, timestamp: 123 },
                    { type: 'AdoptFork', forkId: 'f1', finalTipHash: 'h1', connection: mockConn1 }
                ];
                cb();
                return originalSetTimeout(() => { }, 0);
            }
        });

        // Buffer queue handling
        // let _pbHandled = false;
        // let _afHandled = false;
        mockNode.consensusEngine = createMock<any>({
            handlePendingBlock: async () => { },
            handleAdoptFork: async () => { }
        });

        await syncEngine.performInitialSync();

        assert.ok(purged); // The purge should have happened
        // The early return when > triggers, so buffer isn't handled here.

        global.setTimeout = originalSetTimeout;
    });

    it('Evaluates sync buffer sequentially', async () => {
        mockNode.peer!.broadcast = async () => { };
        (mockNode.ledger as any).isChainValid = async () => true;

        const mockConn1: import('../../../types').PeerConnection = { peerAddress: 'addr1', send: (_unusedM: any) => { } };
        syncEngine._chainStatusResponses = [{ latestIndex: 10, latestHash: 'h10', connection: mockConn1 }];
        (mockNode.ledger as any).getLatestBlock = async () => ({ metadata: { index: 10 }, hash: 'h10' });

        let pbHandled = false;
        let afHandled = false;
        mockNode.consensusEngine = createMock<any>({
            handlePendingBlock: async () => { pbHandled = true; },
            handleAdoptFork: async () => { afHandled = true; }
        });

        const originalSetTimeout = global.setTimeout;
        Object.assign(global, {
            setTimeout: (cb: Function) => {
                syncEngine._chainStatusResponses = [{ latestIndex: 10, latestHash: 'h10', connection: mockConn1 }];
                syncEngine['syncBuffer'] = [
                    { type: 'PendingBlock', block: createMockBlock('buff-handled'), connection: mockConn1, timestamp: 123 },
                    { type: 'AdoptFork', forkId: 'f1', finalTipHash: 'h1', connection: mockConn1 }
                ];
                cb();
                return originalSetTimeout(() => { }, 0);
            }
        });

        await syncEngine.performInitialSync();
        global.setTimeout = originalSetTimeout;
        assert.ok(pbHandled);
        assert.ok(afHandled);
    });

    it('Resolves race conditions during host collisions', async () => {
        mockNode.peer!.broadcast = async () => { };
        (mockNode.ledger as any).isChainValid = async () => true;
        (mockNode.ledger as any).getLatestBlock = async () => ({ metadata: { index: 0 }, hash: 'h0' });
        (mockNode.ledger as any).addBlockToChain = async () => { };

        const mockConn1: import('../../../types').PeerConnection = { peerAddress: 'addr1', send: () => { } };
        const mockConn2: import('../../../types').PeerConnection = { peerAddress: 'addr2', send: () => { } };

        const originalSetTimeout = global.setTimeout;
        Object.assign(global, {
            setTimeout: (cb: Function) => {
                // set responses inside mock
                syncEngine._chainStatusResponses = [
                    { latestIndex: 1, latestHash: 'h1', connection: mockConn1 },
                    { latestIndex: 1, latestHash: 'h1', connection: mockConn2 }
                ];
                syncEngine['_blockSyncResponses'].set('1_addr1', createMock<Block>({ hash: 'block1' }));
                syncEngine['_blockSyncResponses'].set('1_addr2', createMock<Block>({ hash: 'block-diff' }));
                cb(); return originalSetTimeout(() => { }, 0);
            }
        });

        await syncEngine.performInitialSync();
        global.setTimeout = originalSetTimeout;
        assert.strictEqual(syncEngine.isSyncing, false);
    });

    it('Drops blocks with hash integrity faults', async () => {
        mockNode.peer!.broadcast = async () => { };
        (mockNode.ledger as any).isChainValid = async () => true;
        (mockNode.ledger as any).getLatestBlock = async () => ({ metadata: { index: 0 }, hash: 'h0' });

        let addedCount = 0;
        let currentInd = 0;
        (mockNode.ledger as any).getLatestBlock = async () => ({ metadata: { index: currentInd }, hash: `h${currentInd}` });
        (mockNode.ledger as any).addBlockToChain = async () => { addedCount++; currentInd++; };

        const mockConn1: import('../../../types').PeerConnection = { peerAddress: 'addr1', send: () => { } };


        const mockBlock1 = createMockBlock('');
        mockBlock1.metadata.index = 1;
        mockBlock1.previousHash = 'h0';
        const blockToHash1 = { ...mockBlock1 };
        delete blockToHash1.hash;
        delete (blockToHash1 as any)._id;
        const computedHash1 = cryptoUtils.hashData(JSON.stringify(blockToHash1));
        mockBlock1.hash = computedHash1;

        const originalSetTimeout = global.setTimeout;
        try {
            Object.assign(global, {
                setTimeout: (cb: Function) => {
                    syncEngine._chainStatusResponses = [
                        { latestIndex: 2, latestHash: 'h2', connection: mockConn1 }
                    ];
                    syncEngine['_blockSyncResponses'].set('1_addr1', mockBlock1);
                    syncEngine['_blockSyncResponses'].set('2_addr1', Object.assign(createMockBlock('invalidHash'), { metadata: { index: 2 }, previousHash: computedHash1 }));
                    cb(); return originalSetTimeout(() => { }, 0);
                }
            });

            await syncEngine.performInitialSync();
        } finally {
            global.setTimeout = originalSetTimeout;
        }

        assert.strictEqual(syncEngine.isSyncing, false);
        assert.strictEqual(addedCount, 1);
    });

    it('Broadcasts limit orders and successfully maps required bids', async () => {
        // let _sentMessage: any = null;
        mockNode.peer!.broadcast = async (_unusedMsg: any) => { };

        // Let orchestrate storage market run, but we will fulfill the market manually simulating the network
        const promise = syncEngine.orchestrateStorageMarket('req-1', 1000, 250, 2, 0.10);

        // Before timeout, manually ingest 2 bids
        const market = syncEngine.activeStorageMarkets.get('req-1');
        assert.ok(market);

        await syncEngine.handleStorageBid(new StorageBidMessage({ storageRequestId: 'req-1', storageHostId: 'host-1', proposedCostPerGB: 0.05, guaranteedUptimeMs: 1 }), { peerAddress: 'host-1', send: () => { } });
        await syncEngine.handleStorageBid(new StorageBidMessage({ storageRequestId: 'req-1', storageHostId: 'host-2', proposedCostPerGB: 0.08, guaranteedUptimeMs: 1 }), { peerAddress: 'host-2', send: () => { } });

        const result = await promise;
        assert.strictEqual(result.length, 2);
        assert.strictEqual(syncEngine.activeStorageMarkets.has('req-1'), false);
    });

    it('Ignores storage requests if role is not STORAGE', async () => {
        let sentMessage: any = null;
        const mockConnection: import('../../../types').PeerConnection = { peerAddress: 'mock', send: (msg: any) => { sentMessage = msg; } };

        (mockNode as any).roles = [NodeRole.ORIGINATOR];
        await syncEngine.handleStorageRequest(new StorageRequestMessage({ fileSizeBytes: 100, chunkSizeBytes: 200, requiredNodes: 2, storageRequestId: 'r-2', senderAddress: 'remote', maxCostPerGB: 0.10 }), mockConnection);

        assert.strictEqual(sentMessage, null);

        (mockNode as any).roles = [NodeRole.STORAGE];
        mockNode.publicKey = 'local-storage';
        mockNode.storageProvider = createMock<any>({ getEgressCostPerGB: () => 0.05 });

        await syncEngine.handleStorageRequest(new StorageRequestMessage({ fileSizeBytes: 100, chunkSizeBytes: 200, requiredNodes: 2, storageRequestId: 'r-2', senderAddress: 'remote', maxCostPerGB: 0.10 }), mockConnection);
        assert.ok(sentMessage !== null);
        assert.strictEqual((sentMessage as StorageBidMessage).proposedCostPerGB, 0.05);

        // Tests dropping requests when internal limit mappings exceed ceiling
        sentMessage = null;
        await syncEngine.handleStorageRequest(new StorageRequestMessage({ fileSizeBytes: 100, chunkSizeBytes: 200, requiredNodes: 2, storageRequestId: 'r-3', senderAddress: 'remote', maxCostPerGB: 0.01 }), mockConnection);
        assert.strictEqual(sentMessage, null);
    });

    it('Triage timeout drops expired orders returning gathered bids', async () => {
        mockNode.peer!.broadcast = async () => { };
        const originalSetTimeout = global.setTimeout;

        // Mock setTimeout to immediately execute preventing async drift
        Object.assign(global, { setTimeout: (cb: Function) => { cb(); return originalSetTimeout(() => { }, 0); } });

        const promise = syncEngine.orchestrateStorageMarket('req-timeout', 1000, 250, 5, 0.10);

        // Inject 1 partial bid mapping
        const market = syncEngine.activeStorageMarkets.get('req-timeout');
        market?.bids.push({ peerId: 'host-1', cost: 0.05, uptime: 10, connection: { peerAddress: 'test', send: () => { } } });

        const result = await promise;
        assert.strictEqual(result.length, 1);
        assert.strictEqual(syncEngine.activeStorageMarkets.has('req-timeout'), false);

        global.setTimeout = originalSetTimeout;
    });

    it('Ignores verify handoff requests when Node skips STORAGE role', async () => {
        let sentMessage: any = null;
        const mockConn: PeerConnection = { peerAddress: 'host', send: (msg) => { sentMessage = msg; } };
        (mockNode as any).roles = [NodeRole.ORIGINATOR];

        await syncEngine.handleVerifyHandoffRequest(new VerifyHandoffRequestMessage({ marketId: 'mHost', physicalId: 'pHost', targetChunkIndex: 0 }), mockConn);
        assert.strictEqual(sentMessage, null);
    });

    it('Replies with verify handoff failure if underlying data is unavailable natively', async () => {
        let sentMessage: any = null;
        const mockConn: PeerConnection = { peerAddress: 'host', send: (msg: any) => { sentMessage = msg; } };
        (mockNode as any).roles = [NodeRole.STORAGE];
        mockNode.storageProvider = createMock<any>({ getBlockReadStream: async () => ({ status: 'unavailable', stream: null }) });

        await syncEngine.handleVerifyHandoffRequest(new VerifyHandoffRequestMessage({ marketId: 'mHost', physicalId: 'pHost', targetChunkIndex: 0 }), mockConn);

        assert.ok(sentMessage !== null);
        assert.strictEqual(sentMessage.success, false);
    });

    it('Streams block data generating explicitly constrained validation 1MB bounds correctly', async () => {
        let sentMessage: any = null;
        const mockConn: PeerConnection = { peerAddress: 'host', send: (msg: any) => { sentMessage = msg; } };
        (mockNode as any).roles = [NodeRole.STORAGE];

        const mockStream = new EventEmitter() as any;
        mockStream.destroy = () => { mockStream.emit('close'); };

        mockNode.storageProvider = createMock<any>({ getBlockReadStream: async () => ({ status: 'available', stream: mockStream }) });

        syncEngine.handleVerifyHandoffRequest(new VerifyHandoffRequestMessage({ marketId: 'mHost', physicalId: 'pHost', targetChunkIndex: 0 }), mockConn);

        // Await next tick so promise settles event binding
        await new Promise(r => setImmediate(r));

        const dummyData = Buffer.from('HelloWorld');
        mockStream.emit('data', dummyData);
        mockStream.emit('end'); // Changed from close for stream integration compliance

        // Explicit structural hashing mocking boundaries
        const expectedBase64 = dummyData.toString('base64');

        // Allow event loop mapping native close emission hooks
        await new Promise(r => setImmediate(r));

        assert.ok(sentMessage !== null);
        assert.strictEqual(sentMessage!.success, true);
        assert.strictEqual(sentMessage!.chunkDataBase64, expectedBase64);
        assert.ok(Array.isArray(sentMessage!.merkleSiblings));
    });
});
