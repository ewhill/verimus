import assert from 'node:assert';
import * as crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';

import { ObjectId } from 'mongodb';

import { generateRSAKeyPair } from '../../../crypto_utils/CryptoUtils';
import * as proxyCrypto from '../../../crypto_utils/CryptoUtils';
import Mempool from '../../../models/mempool/Mempool';
import type PeerNode from '../../../peer_node/PeerNode';
import { createMock } from '../../../test/utils/TestUtils';
import type { Block, PeerConnection } from '../../../types';
import ConsensusEngine from '../ConsensusEngine';

const mockConn: PeerConnection = { peerAddress: '127.0.0.1:3001', send: () => { } };
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
        mockNode = createMock<PeerNode>({
            port: 3000,
            privateKey: keys.privateKey,
            publicKey: keys.publicKey,
            mempool,
            syncEngine: createMock<any>({ isSyncing: false, syncBuffer: [], performInitialSync: mock.fn<() => Promise<void>>(async () => {}) }),
            getMajorityCount: mock.fn<() => number>(() => 2),
            ledger: createMock<any>({
                collection: createMock<any>({ findOne: mock.fn<(...args: any[]) => Promise<null>>(async () => null) as any }),
                getLatestBlock: mock.fn<(...args: any[]) => Promise<Block>>(async () => ({ ...createMockBlock('sig', 'pk', '0000abc'), metadata: { index: 5, timestamp: 123 }, _id: new ObjectId('000000000000000000000001') }) as any),
                events: { on: mock.fn(), emit: mock.fn(), once: mock.fn() } as any,
                getBlockByIndex: mock.fn<(index: number) => Promise<Block | null>>(async () => ({ metadata: { timestamp: Date.now() - 86400000 * 5 } } as any)),
                addBlockToChain: mock.fn<(block: Block) => Promise<Block>>(async (block: Block) => block),
                blockAddedSubscribers: []
            }),
            peer: createMock<any>({
                trustedPeers: [{ peerAddress: '127.0.0.1:3001', send: () => { } }] as any,
                broadcast: mock.fn<() => Promise<void>>(async () => { }) as any,
                bind: mock.fn<() => void>() as any
            }),
            events: new EventEmitter() as any,
            reputationManager: createMock<any>({
                penalizeMajor: mock.fn<() => Promise<any>>(async () => null as any),
                penalizeCritical: mock.fn<() => Promise<any>>(async () => null as any),
                penalizeMinor: mock.fn<() => Promise<any>>(async () => null as any),
                rewardValidSync: mock.fn<() => Promise<any>>(async () => null as any),
                rewardHonestProposal: mock.fn<() => Promise<any>>(async () => null as any)
            })
        });
        engine = new ConsensusEngine(mockNode);
    });

    afterEach(() => {
        if ((engine as any).proposalTimeout) clearTimeout((engine as any).proposalTimeout);
        if ((engine as any).pendingAdoptTimeout) clearTimeout((engine as any).pendingAdoptTimeout);
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
        const { hash: _unusedH1, ...blockToHash1 } = mockBlock;
        mockBlock.hash = proxyCrypto.hashData(JSON.stringify(blockToHash1));

        const origHandleVerify = engine.handleVerifyBlock;
        const origHandlePropose = engine.handleProposeFork;
        const origHandleAdopt = engine.handleAdoptFork;

        try {
            // Test with bad signature (wrong key)
            const { privateKey: badKey } = proxyCrypto.generateRSAKeyPair();
            mockBlock.signature = proxyCrypto.signData(JSON.stringify(mockBlock.payload), badKey);
            const { hash: _unusedH2, ...blockToHash2 } = mockBlock;
            mockBlock.hash = proxyCrypto.hashData(JSON.stringify(blockToHash2));

            await engine.handlePendingBlock(mockBlock, { peerAddress: 'peer1', send: () => { } }, Date.now());
            assert.strictEqual(verifyCallCount, 0); // Exited early

            // Revert to good signature
            mockBlock.signature = validSignature;
            const { hash: _unusedH3, ...blockToHash3 } = mockBlock;
            mockBlock.hash = proxyCrypto.hashData(JSON.stringify(blockToHash3));

            let broadcastCount = 0;
            mockNode.peer!.broadcast = async () => { broadcastCount++; };

            // Should verify and process successfully generating both a block gossip broadcast and a signature approval broadcast
            await engine.handlePendingBlock(mockBlock, { peerAddress: 'peer1', send: () => { } }, Date.now());
            assert.strictEqual(verifyCallCount, 1);
            assert.strictEqual(broadcastCount, 2);

            // Orphan verification map test
            const blockId = crypto.createHash('sha256').update(mockBlock.signature).digest('hex');
            engine.mempool.orphanedVerifications.set(blockId, [{ signature: 'orphanedSig', connection: { peerAddress: 'peer', send: () => { } } }]);

            // delete the pending to re-enter
            engine.mempool.pendingBlocks.delete(blockId);

            await engine.handlePendingBlock(mockBlock, { peerAddress: 'peer2', send: () => { } }, 0); // No header timestamp
            assert.strictEqual(verifyCallCount, 3); // 1 my + 1 orphan + 1 previous = 3!

            // Test broadcase throw catch
            mockNode.peer!.broadcast = async () => { throw new Error('Broadcast Error'); };
            await engine.handlePendingBlock(mockBlock, { peerAddress: 'peer3', send: () => { } }, 0);
            assert.strictEqual(verifyCallCount, 4); // 1 my verify + 3 previous

            // And also test the bindHandlers lambda functions:
            const bound: Record<string, Function> = {};
            Object.defineProperty(mockNode.peer, 'bind', { value: (msg: { name: string }) => ({ to: (cb: Function) => bound[msg.name] = cb }) });
            engine.bindHandlers();
            assert.ok(bound['PendingBlockMessage']);
            assert.ok(bound['VerifyBlockMessage']);
            assert.ok(bound['ProposeForkMessage']);
            assert.ok(bound['AdoptForkMessage']);

            engine.handleVerifyBlock = async () => { };
            engine.handleProposeFork = async () => { };
            engine.handleAdoptFork = async () => { };
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
        engine.mempool.pendingBlocks.set('block123', {
            block: createMockBlock('sig', 'pk', 'hsh'),
            verifications: new Set(),
            originalTimestamp: Date.now(),
            eligible: false
        });

        await engine.handleVerifyBlock('block123', 'sig1', { peerAddress: '127.0.0.1:3001', send: () => { } });
        // Since myAddress is automatically added (self-vote), the count reaches 2 (majority) immediately
        assert.strictEqual(engine.mempool.pendingBlocks.get('block123')?.eligible, true);

        // Timeout cleanup
        if (engine.proposalTimeout) clearTimeout(engine.proposalTimeout);
    });

    it('Buffers adopt fork requests during sync', async () => {
        mockNode.syncEngine.isSyncing = true;
        await engine.handleAdoptFork('fork123_mockHashConstraint123', 'hashy', { peerAddress: 'addr', send: () => { } });
        assert.strictEqual(mockNode.syncEngine.syncBuffer.length, 1);
    });

    it('Evaluates proposed fork chains against local ledger', async () => {
        const mockConn1: PeerConnection = { peerAddress: '127.0.0.1:3001', send: () => { } };
        engine.mempool.pendingBlocks.set('block1', {
            block: createMockBlock('sig1', 'pk1', 'hsh'),
            verifications: new Set(),
            eligible: true,
            originalTimestamp: Date.now()
        });
        await engine.handleProposeFork('fork1', ['block1'], mockConn1);
        const fork = engine.mempool.eligibleForks.get('fork1');
        assert.ok(fork !== undefined);
        // Note: myAddress (self-vote) is automatically added if we agree, making the size 2.
        assert.strictEqual(fork.proposals.size, 2);
        
        // Because majority is 2, it is adopted immediately
        assert.strictEqual(fork.adopted, true);
    });

    it('Commits validated fork chains', async () => {
        engine.mempool.eligibleForks.set('forkCommit', { adopted: true, proposals: new Set(), blockIds: ['b1'], computedBlocks: [{ ...createMockBlock('sig1', 'pk', 'hsh'), previousHash: 'lastHash123', metadata: { index: 1, timestamp: Date.now() } }] });
        engine.mempool.settledForks.set('forkCommit', { finalTipHash: 'hashx', adoptions: new Set(), committed: false, pendingCommit: false });
        engine.mempool.pendingBlocks.set(crypto.createHash('sha256').update('sig1').digest('hex'), {
            block: createMockBlock('sig1', 'pk', 'hsh'), verifications: new Set(), eligible: true, originalTimestamp: Date.now(), committed: false
        });

        Object.defineProperty(mockNode.ledger, 'collection', { value: { findOne: async () => null }, writable: true });
        mockNode.ledger.getLatestBlock = async () => ({ ...createMockBlock('', '', 'lastHash123'), metadata: { index: 0, timestamp: Date.now() }, _id: new ObjectId() });

        let addBlockCallCount = 0;
        mockNode.ledger.addBlockToChain = async (b: Block) => { addBlockCallCount++; return b; };

        await engine._commitFork('forkCommit');
        assert.ok(addBlockCallCount > 0);
        assert.ok(engine.mempool.settledForks.get('forkCommit')?.committed);
    });

    it('Drops obsolete or light fork proposals', async () => {
        engine.mempool.eligibleForks.set('forkStale', { adopted: true, proposals: new Set(), blockIds: ['b1'], computedBlocks: [{ ...createMockBlock('sig1', 'pk', 'wrongHash'), previousHash: 'wrongHash', metadata: { index: 1, timestamp: Date.now() } }] });
        engine.mempool.settledForks.set('forkStale', { finalTipHash: 'hashx', adoptions: new Set(), committed: false, pendingCommit: false });

        mockNode.ledger.getLatestBlock = async () => ({ ...createMockBlock('', '', 'lastHash123'), metadata: { index: 0, timestamp: Date.now() }, _id: new ObjectId() });

        await engine._commitFork('forkStale');
        assert.ok(!engine.mempool.settledForks.get('forkStale')?.committed);
    });

    it('Rejects duplicate block indices', async () => {
        engine.committing = false;

        Object.defineProperty(mockNode.ledger, 'collection', { value: { findOne: async () => ({ ...createMockBlock('', '', ''), hash: 'exists', _id: new ObjectId() }) }, writable: true });
        mockNode.ledger.getLatestBlock = async () => ({ ...createMockBlock('', '', 'lastHash'), metadata: { index: 0, timestamp: 0 }, _id: new ObjectId() });

        const mockForkEntry = {
            computedBlocks: [{ ...createMockBlock('sig1', 'pk', 'lastHash'), previousHash: 'lastHash', metadata: { index: 1, timestamp: Date.now() } }],
            adopted: true, proposals: new Set<string>(), blockIds: []
        };
        const mockSettledEntry = { finalTipHash: 'hash1', adoptions: new Set<string>(), committed: false, pendingCommit: false };
        engine.mempool.eligibleForks.set('forkDup', mockForkEntry);
        engine.mempool.settledForks.set('forkDup', mockSettledEntry);

        const mockSigHash = crypto.createHash('sha256').update('sig1').digest('hex');
        const mockPendingEntry = { committed: false, block: createMockBlock('sig1', 'pk', 'hash1'), verifications: new Set<string>(), eligible: true, originalTimestamp: Date.now() };
        engine.mempool.pendingBlocks.set(mockSigHash, mockPendingEntry);

        await engine._commitFork('forkDup');
        assert.strictEqual(mockPendingEntry.committed, true);
        assert.strictEqual(mockSettledEntry.committed, true);
    });

    it('Executes deferred fork commitments', async () => {

        // Test handleAdoptFork where majority reached but no computedBlocks
        const adoptions = new Set<string>();
        adoptions.add('peer1');
        adoptions.add('peer2');
        const mockSettledEntry = { finalTipHash: 'hash3', adoptions, committed: false, pendingCommit: false };
        engine.mempool.settledForks.set('forkAdopt', mockSettledEntry);
        engine.mempool.eligibleForks.set('forkAdopt', { computedBlocks: [{ ...createMockBlock('sigx', 'addr', 'hash'), previousHash: '0000abc' }] as Block[], adopted: true, proposals: new Set<string>(), blockIds: [] });
        mockNode.getMajorityCount = () => 2;

        engine.committing = true;
        await engine.handleAdoptFork('forkAdopt', 'hash3', { peerAddress: 'peer3', send: () => { } });

        // Await the task queue to natively drain the executing bounds implicitly securely
        await (engine as any).taskQueue;

        assert.ok(mockSettledEntry.pendingCommit || mockSettledEntry.committed);

        // Setup variables for mock block execution tests mapping explicitly natively
        engine.mempool.eligibleForks.set('forkCommit', { computedBlocks: [{ ...createMockBlock('sigCom', 'pk', 'hsh'), previousHash: 'lastHash', metadata: { index: 1, timestamp: Date.now() } }], adopted: true, proposals: new Set<string>(), blockIds: [] });
        engine.mempool.settledForks.set('forkCommit', { finalTipHash: 'hash', adoptions: new Set<string>(), committed: false, pendingCommit: false });

        Object.defineProperty(mockNode.ledger, 'collection', { value: { findOne: async () => null }, writable: true });
        const hashStr = crypto.createHash('sha256').update('sigCom').digest('hex');
        engine.mempool.pendingBlocks.set(hashStr, { committed: false, block: createMockBlock('sig', 'pk', 'hash'), verifications: new Set<string>(), eligible: true, originalTimestamp: Date.now() });

        mockNode.ledger.getLatestBlock = async () => ({ ...createMockBlock('', '', 'lastHash'), metadata: { index: 0, timestamp: 0 }, _id: new ObjectId() });

        let addedCount = 0;
        mockNode.ledger.addBlockToChain = async (b: Block) => { addedCount++; return b; };

        await engine._commitFork('forkCommit');
        assert.ok(addedCount > 0);
        assert.strictEqual(engine.mempool.pendingBlocks.get(hashStr), undefined, 'Pending block MUST be purged post-commit');
    });

    it('Validates exception mappings during p2p error broadcast', async () => {
        // Test broadcast exception in propose fork
        mockNode.peer!.broadcast = async () => { throw new Error('Broadcast Error Propose'); };
        engine.mempool.pendingBlocks.set('blockZ', {
            block: createMockBlock('sigZ', 'pkZ', 'hsh'),
            originalTimestamp: 1000,
            verifications: new Set(['a', 'b']),
            eligible: false
        });
        engine['proposalTimeout'] = null;

        // Force a verification check
        mockNode.getMajorityCount = () => 1;

        // Await the detached verification boundary triggering the 500ms timeout
        await engine.handleVerifyBlock('blockZ', 'sigZ', { peerAddress: 'peer3', send: () => { } });

        // Native real-time wait isolating concurrent thread
        await new Promise(r => setTimeout(r, 650));

        const realForkId = crypto.createHash('sha256').update(['blockZ'].join(',')).digest('hex');

        // Test broadcast exception in adopt fork manually to ensure secondary branch mapping
        mockNode.peer!.broadcast = async () => { throw new Error('Broadcast Error Adopt'); };
        await engine.handleProposeFork(realForkId, ['blockZ'], { peerAddress: 'peer4', send: () => { } });

        const settledEntry = engine.mempool.settledForks.get(realForkId);
        assert.ok(settledEntry !== undefined, 'Settled entry MUST exist post-proposal');

        // Test calling adopt fork triggering commit with computed blocks
        await engine.handleAdoptFork(realForkId, settledEntry.finalTipHash, { peerAddress: 'peer4', send: () => { } });

        assert.ok(settledEntry.committed || settledEntry.pendingCommit, 'SettledFork entry must reflect committed bounding state or pendingCommit after handleAdoptFork');
    });

    it('Auditor securely rejects incorrectly forged 64KB physical buffers validating Merkle bounds', async () => {
        let penaltyHit = false;
        mockNode.reputationManager.penalizeCritical = async (peerId: string, reason: string) => {
            if (peerId === 'malicious_host' && reason === 'Proof of Spacetime Forgery') {
                penaltyHit = true;
            }
            return null;
        };

        const mockPayload = {
            merkleRoots: ['real_hash_root_123'],
            fragmentMap: [{ nodeId: 'malicious_host', shardIndex: 0, physicalId: 'phys' }],
            erasureParams: { k: 1, n: 1, originalSize: 1024 }
        };

        const mockBlock = {
            _id: new ObjectId('507f1f77bcf86cd799439011'),
            type: 'STORAGE_CONTRACT',
            payload: mockPayload
        };

        // Inject probabilistic pass
        const randomStub = Math.random;
        Math.random = () => 0.1; // Bypass 0.2 threshold
        mockNode.syncEngine.isSyncing = false;

        Object.defineProperty(mockNode.ledger, 'collection', {
            value: {
                find: () => ({ sort: () => ({ limit: () => ({ toArray: async () => [mockBlock] }) }) })
            },
            writable: true
        });

        await engine.runGlobalAudit();

        // Simulate returning bad forgery bytes breaking mathematical proofs dynamically
        mockNode.events.emit(`merkle_audit_response:507f1f77bcf86cd799439011:phys`, {
            computedRootMatch: true,
            chunkDataBase64: Buffer.from('FAKE BAD BYTES TRASH BOUNDARY').toString('base64'),
            merkleSiblings: ['another_hash']
        });

        // Wait natively
        await new Promise(r => setTimeout(r, 50));

        Math.random = randomStub;

        assert.strictEqual(penaltyHit, true, 'Auditor successfully rejected forged 64KB physical bounded tree hash completely');
    });
});
