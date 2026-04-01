import fs from 'fs';
import assert from 'node:assert';
import { describe, it, before, after } from 'node:test';
import os from 'os';
import path from 'path';

import { MongoMemoryServer } from 'mongodb-memory-server';

import Bundler from '../../bundler/Bundler';
import PeerNode from '../../peer_node/PeerNode';
import MemoryStorageProvider from '../../storage_providers/memory_provider/MemoryProvider';


describe('Integration: Network Partition Resiliency & Byzantine Fault Simulation (Phase 3)', () => {
    let mongod1: MongoMemoryServer;
    let mongod2: MongoMemoryServer;
    let node1: PeerNode;
    let node2: PeerNode;
    let node3: PeerNode;

    let tmp1: string, tmp2: string, tmp3: string;
    before(async () => {
        mongod1 = await MongoMemoryServer.create();
        mongod2 = await MongoMemoryServer.create();

        tmp1 = fs.mkdtempSync(path.join(os.tmpdir(), 'verimus-'));
        // Node 1 (Partition A)
        node1 = new PeerNode(0, ['127.0.0.1:31002', '127.0.0.1:31003'], new MemoryStorageProvider(), new Bundler(tmp1), mongod1.getUri(), undefined, {
            ringPublicKeyPath: 'keys/ring.ring.pub',
            publicKeyPath: 'keys/peer_31001.peer.pub',
            privateKeyPath: 'keys/peer_31001.peer.pem',
            signaturePath: 'keys/peer_31001.peer.signature'
        }, tmp1);

        tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'verimus-'));
        // Node 2 (Partition A)
        node2 = new PeerNode(0, ['127.0.0.1:31001', '127.0.0.1:31003'], new MemoryStorageProvider(), new Bundler(tmp2), mongod1.getUri(), undefined, {
            ringPublicKeyPath: 'keys/ring.ring.pub',
            publicKeyPath: 'keys/peer_31002.peer.pub',
            privateKeyPath: 'keys/peer_31002.peer.pem',
            signaturePath: 'keys/peer_31002.peer.signature'
        }, tmp2);

        tmp3 = fs.mkdtempSync(path.join(os.tmpdir(), 'verimus-'));
        // Node 3 (Partition B - Isolated DB and Network)
        node3 = new PeerNode(0, ['127.0.0.1:31001'], new MemoryStorageProvider(), new Bundler(tmp3), mongod2.getUri(), undefined, {
            ringPublicKeyPath: 'keys/ring.ring.pub',
            publicKeyPath: 'keys/peer_31003.peer.pub',
            privateKeyPath: 'keys/peer_31003.peer.pem',
            signaturePath: 'keys/peer_31003.peer.signature'
        }, tmp3);

        // We will mock keys internally for nodes to bypass generation overhead since the test relies on network topologies
        const mockKeys = (node: PeerNode) => {
             node.publicKey = 'PUB';
             node.privateKey = 'PRIV';
             node.signature = 'SIG';
        };
        mockKeys(node1); mockKeys(node2); mockKeys(node3);

        const initWithoutServer = async (node: PeerNode) => {
             await node.ledger.init(node.port);
             await node.loadOwnedBlocksCache();
             // Mock peer initialization for controlled connectivity mapping
             const mockPeer = {
                  trustedPeers: [],
                  broadcast: async () => {},
                  bind: () => ({ to: () => {} }),
                  close: async () => {}
             };
             Object.assign(node, { peer: mockPeer });
        };

        await Promise.all([initWithoutServer(node1), initWithoutServer(node2), initWithoutServer(node3)]);
    });

    after(async () => {
        await Promise.all([
             node1.ledger.client?.close(),
             node2.ledger.client?.close(),
             node3.ledger.client?.close(),
             mongod1.stop(),
             mongod2.stop()
        ]);
        
        fs.rmSync(tmp1, { recursive: true, force: true });
        fs.rmSync(tmp2, { recursive: true, force: true });
        fs.rmSync(tmp3, { recursive: true, force: true });
    });

    it('Drops minority forks during Network Partition', async () => {
        // Total Network Size = 3 (Majority = 2)
        Object.assign(node1.peer || {}, { trustedPeers: ['127.0.0.1:31002', '127.0.0.1:31003'] });
        Object.assign(node2.peer || {}, { trustedPeers: ['127.0.0.1:31001', '127.0.0.1:31003'] });
        
        // Node 3 suffers a Byzantine Partition and only sees Node 1 (Simulated Split Brain)
        Object.assign(node3.peer || {}, { trustedPeers: ['127.0.0.1:31001'] });
        
        const majority = node3.getMajorityCount();
        assert.strictEqual(majority, 2, 'Node 3 bounds a local perception majority counting correctly.');

        // Node 3 tries to formulate a rogue fork on its own isolated chain mappings
        node3.mempool.pendingBlocks.set('rogue_block', {
            block: { type: 'TRANSACTION', metadata: { index: 1, timestamp: 1 }, publicKey: 'pk', signature: 'sig', hash: 'rogue_block', payload: { senderSignature: '', senderId: '', recipientId: '', amount: 0 } },
            verifications: new Set(),
            eligible: true,
            originalTimestamp: Date.now()
        });
        node3.mempool.eligibleForks.set('rogue_fork', { blockIds: ['rogue_block'], proposals: new Set(['127.0.0.1:31003']), adopted: false, computedBlocks: [] });
        
        await node3.consensusEngine.handleProposeFork('rogue_fork', ['rogue_block'], { peerAddress: '127.0.0.1:31003', send: () => {} });
        
        // Assert the fork is NOT adopted because it didn't cross the threshold
        const fork = node3.mempool.eligibleForks.get('rogue_fork');
        assert.ok(!fork?.adopted, 'Partitioned node legitimately stalled preventing anomalous fork inclusion!');
    });

    it('Coordinates adoption across majority segments', async () => {
        node1.mempool.pendingBlocks.set('valid_block', {
            block: { type: 'TRANSACTION', metadata: { index: 2, timestamp: 2 }, publicKey: 'pk', signature: 'sig', hash: 'valid_block', payload: { senderSignature: '', senderId: '', recipientId: '', amount: 0 } },
            verifications: new Set(),
            eligible: true,
            originalTimestamp: Date.now()
        } as any);
        node1.mempool.eligibleForks.set('valid_fork', { blockIds: ['valid_block'], proposals: new Set(['127.0.0.1:31001']), adopted: false, computedBlocks: [] });
        
        // Node 2 votes for Node 1's proposal forming the required majority mapping
        await node1.consensusEngine.handleProposeFork('valid_fork', ['valid_block'], { peerAddress: '127.0.0.1:31002', send: () => {} });
        
        const fork = node1.mempool.eligibleForks.get('valid_fork');
        assert.ok(fork?.adopted, 'Primary partition scaled and mathematically executed the fork adoption over majority boundaries.');
    });
});
