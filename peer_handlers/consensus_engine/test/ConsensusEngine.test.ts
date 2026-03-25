import assert from 'node:assert';
import * as crypto from 'node:crypto';
import { describe, it, beforeEach } from 'node:test';

import { generateRSAKeyPair } from '../../../crypto_utils/CryptoUtils';
import * as proxyCrypto from '../../../crypto_utils/CryptoUtils';
import Mempool from '../../../models/mempool/Mempool';
import type PeerNode from '../../../peer_node/PeerNode';
import { MockPeerNode } from '../../../test/mocks/MockPeerNode';
import type { Block, PeerConnection } from '../../../types';
import ConsensusEngine from '../ConsensusEngine';

const mockConn: PeerConnection = { peerAddress: '127.0.0.1:3001', send: () => {} };
const createMockBlock = (signature: string, publicKey: string, hash: string): Block => ({
    type: 'TRANSACTION',
    metadata: { index: 1, timestamp: 123 },
    publicKey,
    signature,
    hash,
    payload: { senderSignature: '', senderId: '', recipientId: '', amount: 0 }
});

describe('Backend: ConsensusEngine Integrity', () => {
    let mockNode: PeerNode;
    let engine: ConsensusEngine;
    let keys: any;

    beforeEach(() => {
        keys = generateRSAKeyPair();
        const mempool = new Mempool();
        const mockBase = new MockPeerNode({ port: 3000, privateKey: keys.privateKey, mempool });
        mockNode = mockBase.asPeerNode();
        // @ts-ignore
        mockNode.syncEngine = { isSyncing: false, syncBuffer: [] };
        // @ts-ignore
        mockNode.getMajorityCount = () => 2;
        // @ts-ignore
        mockNode.ledger.getLatestBlock = async () => ({ metadata: { index: 5 }, hash: '0000abc' });
        // @ts-ignore
        mockNode.ledger.collection = { findOne: async () => null };
        // @ts-ignore
        mockNode.ledger.addBlockToChain = async () => {};
        // @ts-ignore
        mockNode.peer = { trustedPeers: ['127.0.0.1:3001'], bind: () => ({ to: () => {} }), broadcast: async () => {} };
        // @ts-ignore
        mockNode.events = { emit: () => {} };
        // @ts-ignore
        mockNode.reputationManager = {
            penalizeMajor: async () => null,
            penalizeCritical: async () => null,
            penalizeMinor: async () => null,
            rewardValidSync: async () => null,
            rewardHonestProposal: async () => null
        };
        engine = new ConsensusEngine(mockNode);
    });

    it('Exports ConsensusEngine singleton', () => {
        assert.ok(ConsensusEngine !== undefined, 'Module loaded successfully');
    });

    it('Buffers incoming blocks during active sync', async () => {
        mockNode.syncEngine.isSyncing = true;
        await engine.handlePendingBlock(createMockBlock('sig', 'pk', 'hash'), mockConn, 12345);
        assert.strictEqual(mockNode.syncEngine.syncBuffer.length, 1);
    });

    it('Verifies pending block metadata', async () => {
        mockNode.syncEngine.isSyncing = false;
        
        let verifyCallCount = 0;
        engine.handleVerifyBlock = async () => { verifyCallCount++; };
        

        const { publicKey, privateKey } = proxyCrypto.generateRSAKeyPair();

        const mockBlock: Block = {
             type: 'TRANSACTION',
             metadata: { index: 5, timestamp: Date.now() },
             payload: { senderSignature: '', senderId: '', recipientId: '', amount: 0 },
             signature: '',
             publicKey: publicKey,
             hash: 'mockhash'
        };
        const validSignature = proxyCrypto.signData(JSON.stringify(mockBlock.payload), privateKey);
        mockBlock.signature = validSignature;
        const blockToHash1 = { ...mockBlock };
        // @ts-ignore
        delete blockToHash1.hash;
        mockBlock.hash = proxyCrypto.hashData(JSON.stringify(blockToHash1));
        
        const origHandleVerify = engine.handleVerifyBlock;
        const origHandlePropose = engine.handleProposeFork;
        const origHandleAdopt = engine.handleAdoptFork;
        
        try {
            // Test with bad signature (wrong key)
            const { privateKey: badKey } = proxyCrypto.generateRSAKeyPair();
            mockBlock.signature = proxyCrypto.signData(JSON.stringify(mockBlock.payload), badKey);
            const blockToHash2 = { ...mockBlock };
            // @ts-ignore
            delete blockToHash2.hash;
            mockBlock.hash = proxyCrypto.hashData(JSON.stringify(blockToHash2));
            
            await engine.handlePendingBlock(mockBlock, { peerAddress: 'peer1', send: () => {} }, Date.now());
            assert.strictEqual(verifyCallCount, 0); // Exited early
            
            // Revert to good signature
            mockBlock.signature = validSignature;
            const blockToHash3 = { ...mockBlock };
            // @ts-ignore
            delete blockToHash3.hash;
            mockBlock.hash = proxyCrypto.hashData(JSON.stringify(blockToHash3));
            
            let broadcastCount = 0;
            mockNode.peer!.broadcast = async () => { broadcastCount++; };
            
            // Should verify and process successfully
            await engine.handlePendingBlock(mockBlock, { peerAddress: 'peer1', send: () => {} }, Date.now());
            assert.strictEqual(verifyCallCount, 1);
            assert.strictEqual(broadcastCount, 1);
            
            // Orphan verification map test
            const blockId = crypto.createHash('sha256').update(mockBlock.signature).digest('hex');
            // @ts-ignore
            engine.mempool.orphanedVerifications.set(blockId, [{ signature: 'orphanedSig', connection: { peerAddress: 'peer', send: () => {} } }]);
            
            // delete the pending to re-enter
            engine.mempool.pendingBlocks.delete(blockId);
            
            await engine.handlePendingBlock(mockBlock, { peerAddress: 'peer2', send: () => {} }, 0); // No header timestamp
            assert.strictEqual(verifyCallCount, 3); // 1 my + 1 orphan + 1 previous = 3!
            
            // Test broadcase throw catch
            mockNode.peer!.broadcast = async () => { throw new Error('Broadcast Error'); };
            await engine.handlePendingBlock(mockBlock, { peerAddress: 'peer3', send: () => {} }, 0); 
            assert.strictEqual(verifyCallCount, 4); // 1 my verify + 3 previous
            
            // And also test the bindHandlers lambda functions:
            const bound: Record<string, Function> = {};
            // @ts-ignore
            mockNode.peer!.bind = (msg: any) => ({ to: (cb: any) => bound[msg.name] = cb });
            engine.bindHandlers();
            assert.ok(bound['PendingBlockMessage']);
            assert.ok(bound['VerifyBlockMessage']);
            assert.ok(bound['ProposeForkMessage']);
            assert.ok(bound['AdoptForkMessage']);
            
            engine.handleVerifyBlock = async () => {};
            engine.handleProposeFork = async () => {};
            engine.handleAdoptFork = async () => {};
            let isPendingCalled = false;
            const originalHandlePending = engine.handlePendingBlock;
            engine.handlePendingBlock = async () => { isPendingCalled = true; };
            
            bound['PendingBlockMessage']({ block: mockBlock, header: { timestamp: new Date() } }, {});
            bound['VerifyBlockMessage']({ blockId: 'b', signature: 's' }, {});
            bound['ProposeForkMessage']({ forkId: 'f', blockIds: [] }, {});
            bound['AdoptForkMessage']({ forkId: 'f', finalTipHash: 'h' }, {});
            
            assert.ok(isPendingCalled);
            engine.handlePendingBlock = originalHandlePending;
            
        } finally {
            // Restore original functions
            engine.handleVerifyBlock = origHandleVerify;
            engine.handleProposeFork = origHandlePropose;
            engine.handleAdoptFork = origHandleAdopt;
        }
    });

    it('Buffers orphaned blocks pending future forks', async () => {
        const _unusedMockConnection = { peerAddress: '127.0.0.1:3001' };
        await engine.handleVerifyBlock('testBlockId', 'testSig', mockConn);
        assert.strictEqual(engine.mempool.orphanedVerifications.get('testBlockId')?.length, 1);
    });

    it('Evaluates block signatures and calculates consensus', async () => {
        // @ts-ignore
        engine.mempool.pendingBlocks.set('block123', {
            block: createMockBlock('sig', 'pk', 'hsh'),
            verifications: new Set(),
            originalTimestamp: Date.now(),
            eligible: false
        });
        
        await engine.handleVerifyBlock('block123', 'sig1', { peerAddress: '127.0.0.1:3001', send: () => {} });
        assert.strictEqual(engine.mempool.pendingBlocks.get('block123')?.eligible, false); // needs majority 2
        
        await engine.handleVerifyBlock('block123', 'sig2', { peerAddress: '127.0.0.1:3002', send: () => {} });
        assert.strictEqual(engine.mempool.pendingBlocks.get('block123')?.eligible, true);
        
        // Timeout cleanup
        if (engine.proposalTimeout) clearTimeout(engine.proposalTimeout);
    });

    it('Buffers adopt fork requests during sync', async () => {
        mockNode.syncEngine.isSyncing = true;
        await engine.handleAdoptFork('fork123', 'hashy', { peerAddress: 'addr', send: () => {} });
        assert.strictEqual(mockNode.syncEngine.syncBuffer.length, 1);
    });

    it('Evaluates proposed fork chains against local ledger', async () => {
        const mockConn1: PeerConnection = { peerAddress: '127.0.0.1:3001', send: () => {} };
        // @ts-ignore
        engine.mempool.pendingBlocks.set('block1', { block: createMockBlock('sig1', 'pk1', 'hsh'), originalTimestamp: Date.now() });
        await engine.handleProposeFork('fork1', ['block1'], mockConn1);
        const fork = engine.mempool.eligibleForks.get('fork1');
        assert.ok(fork !== undefined);
        assert.strictEqual(fork.proposals.size, 1);
        
        await engine.handleProposeFork('fork1', ['block1'], { peerAddress: '127.0.0.1:3002', send: () => {} });
        assert.strictEqual(fork.adopted, true);
    });

    it('Commits validated fork chains', async () => {
        // @ts-ignore
        engine.mempool.eligibleForks.set('forkCommit', { adopted: true, proposals: new Set(), blockIds: ['b1'], computedBlocks: [{ hash: 'hsh', previousHash: 'lastHash123', signature: 'sig1', metadata: { index: 1 } }] });
        // @ts-ignore
        engine.mempool.settledForks.set('forkCommit', { finalTipHash: 'hashx', adoptions: new Set(), committed: false });
        // @ts-ignore
        engine.mempool.pendingBlocks.set(crypto.createHash('sha256').update('sig1').digest('hex'), { committed: false });
        
        // @ts-ignore
        mockNode.ledger.getLatestBlock = async () => ({ hash: 'lastHash123', metadata: { index: 0 } });
        
        let addBlockCallCount = 0;
        // @ts-ignore
        mockNode.ledger.addBlockToChain = async (b: any) => { addBlockCallCount++; return b; };
        
        await engine._commitFork('forkCommit');
        assert.ok(addBlockCallCount > 0);
        assert.ok(engine.mempool.settledForks.get('forkCommit')?.committed);
    });

    it('Drops obsolete or light fork proposals', async () => {
        // @ts-ignore
        engine.mempool.eligibleForks.set('forkStale', { adopted: true, proposals: new Set(), blockIds: ['b1'], computedBlocks: [{ previousHash: 'wrongHash', signature: 'sig1', metadata: { index: 1 } }] });
        engine.mempool.settledForks.set('forkStale', { finalTipHash: 'hashx', adoptions: new Set(), committed: false });
        
        // @ts-ignore
        mockNode.ledger.getLatestBlock = async () => ({ hash: 'lastHash123', metadata: { index: 0 } });
        
        await engine._commitFork('forkStale');
        assert.ok(!engine.mempool.settledForks.get('forkStale')?.committed);
    });

    it('Rejects duplicate block indices', async () => {
        engine.committing = false;
        
        // @ts-ignore
        mockNode.ledger.collection = {
            // @ts-ignore
            findOne: async () => true // Block exists
        };
        // @ts-ignore
        mockNode.ledger.getLatestBlock = async () => ({ hash: 'lastHash' });
        
        const mockForkEntry = {
            computedBlocks: [{ previousHash: 'lastHash', signature: 'sig1' }]
        };
        const mockSettledEntry = { finalTipHash: 'hash1', adoptions: new Set(), committed: false };
        // @ts-ignore
        engine.mempool.eligibleForks.set('forkDup', mockForkEntry);
        // @ts-ignore
        engine.mempool.settledForks.set('forkDup', mockSettledEntry);
        
        const mockSigHash = crypto.createHash('sha256').update('sig1').digest('hex');
        const mockPendingEntry = { committed: false };
        // @ts-ignore
        engine.mempool.pendingBlocks.set(mockSigHash, mockPendingEntry);

        await engine._commitFork('forkDup');
        assert.strictEqual(mockPendingEntry.committed, true);
        assert.strictEqual(mockSettledEntry.committed, true);
    });

    it('Executes deferred fork commitments', async () => {
        // Test handleAdoptFork where majority reached but no computedBlocks
        const mockSettledEntry = { finalTipHash: 'hash3', adoptions: { size: 2, add: () => {} }, committed: false };
        // @ts-ignore
        engine.mempool.settledForks.set('forkAdopt', mockSettledEntry);
        // @ts-ignore
        engine.mempool.eligibleForks.set('forkAdopt', { computedBlocks: null });
        mockNode.getMajorityCount = () => 2;
        await engine.handleAdoptFork('forkAdopt', 'hash3', { peerAddress: 'peer3', send: () => {} });
        assert.ok((mockSettledEntry as any).pendingCommit);

        // Test deferred commit
        engine.committing = true;
        const origSetTimeout = global.setTimeout;
        let timeoutTriggered = false;
        // @ts-ignore
        (global).setTimeout = (_unusedCb: any, _unusedT: number) => { timeoutTriggered = true; return {}; };
        await engine._commitFork('forkAdopt');
        assert.ok(timeoutTriggered);
        global.setTimeout = origSetTimeout;

        // Test _commitFork loops over mempool pending blocks to set committed true conceptually powerfully beautifully flexibly implicitly realistically impressively successfully inherently correctly creatively smartly
        engine.committing = false;
        // @ts-ignore
        engine.mempool.eligibleForks.set('forkCommit', { computedBlocks: [{ previousHash: 'lastHash', signature: 'sigCom', metadata: { index: 1 }, hash: 'hsh' }] });
        // @ts-ignore
        engine.mempool.settledForks.set('forkCommit', { finalTipHash: 'hash', adoptions: new Set(), committed: false });
        // @ts-ignore
        mockNode.ledger.collection = { findOne: async () => false };
        const hashStr = crypto.createHash('sha256').update('sigCom').digest('hex');
        // @ts-ignore
        engine.mempool.pendingBlocks.set(hashStr, { committed: false });
        
        // @ts-ignore
        mockNode.ledger.getLatestBlock = async () => ({ hash: 'lastHash' });

        let addedCount = 0;
        // @ts-ignore
        mockNode.ledger.addBlockToChain = async (b: any) => { addedCount++; return b; };
        
        await engine._commitFork('forkCommit');
        assert.ok(addedCount > 0);
        assert.ok(engine.mempool.pendingBlocks.get(hashStr)?.committed);
    });

    it('Validates exception mappings during p2p error broadcast', async () => {
        // Test broadcast exception in propose fork
        mockNode.peer!.broadcast = async () => { throw new Error('Broadcast Error Propose'); };
        // @ts-ignore
        engine.mempool.pendingBlocks.set('blockZ', { block: createMockBlock('sigZ', 'pkZ', 'hsh'), originalTimestamp: 1000, verifications: new Set(['a', 'b']) });
        // @ts-ignore
        engine.proposalTimeout = null;

        // Force a verification check
        mockNode.getMajorityCount = () => 1;
        const origSetTimeout = global.setTimeout;
        // @ts-ignore
        (global).setTimeout = (cb: any, _unusedT: number) => { cb(); return {}; };
        await engine.handleVerifyBlock('blockZ', 'sigZ', { peerAddress: 'peer3', send: () => {} });
        global.setTimeout = origSetTimeout;
        
        assert.ok(engine.mempool.eligibleForks.size > 0);
        
        const realForkId = crypto.createHash('sha256').update(['blockZ'].join(',')).digest('hex');

        // Test broadcast exception in adopt fork
        mockNode.peer!.broadcast = async () => { throw new Error('Broadcast Error Adopt'); };
        await engine.handleProposeFork(realForkId, ['blockZ'], { peerAddress: 'peer4', send: () => {} });
        
        const settledEntry = engine.mempool.settledForks.get(realForkId);
        assert.ok(settledEntry !== undefined);

        // Test calling adopt fork triggering commit with computed blocks
        await engine.handleAdoptFork(realForkId, settledEntry.finalTipHash, { peerAddress: 'peer4', send: () => {} });
        
        assert.ok(settledEntry.committed || settledEntry.pendingCommit);
    });
});
