import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { MongoMemoryServer } from 'mongodb-memory-server';
import PeerNode from '../../peer_node/PeerNode';
import MemoryStorageProvider from '../../storage_providers/memory_provider/MemoryProvider';
import Bundler from '../../bundler/Bundler';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Integration: Network Partition Resiliency & Byzantine Fault Simulation (Phase 3)', () => {
    let mongod1: MongoMemoryServer;
    let mongod2: MongoMemoryServer;
    let node1: PeerNode;
    let node2: PeerNode;
    let node3: PeerNode;

    before(async () => {
        mongod1 = await MongoMemoryServer.create();
        mongod2 = await MongoMemoryServer.create();

        const tmp1 = fs.mkdtempSync(path.join(os.tmpdir(), 'verimus-'));
        // Node 1 (Partition A)
        node1 = new PeerNode(31001, ['127.0.0.1:31002', '127.0.0.1:31003'], new MemoryStorageProvider(), new Bundler(tmp1), mongod1.getUri(), undefined, {
            ringPublicKeyPath: 'keys/ring.ring.pub',
            publicKeyPath: 'keys/peer_31001.peer.pub',
            privateKeyPath: 'keys/peer_31001.peer.pem',
            signaturePath: 'keys/peer_31001.peer.signature'
        }, tmp1);

        const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'verimus-'));
        // Node 2 (Partition A)
        node2 = new PeerNode(31002, ['127.0.0.1:31001', '127.0.0.1:31003'], new MemoryStorageProvider(), new Bundler(tmp2), mongod1.getUri(), undefined, {
            ringPublicKeyPath: 'keys/ring.ring.pub',
            publicKeyPath: 'keys/peer_31002.peer.pub',
            privateKeyPath: 'keys/peer_31002.peer.pem',
            signaturePath: 'keys/peer_31002.peer.signature'
        }, tmp2);

        const tmp3 = fs.mkdtempSync(path.join(os.tmpdir(), 'verimus-'));
        // Node 3 (Partition B - Isolated DB and Network)
        node3 = new PeerNode(31003, ['127.0.0.1:31001'], new MemoryStorageProvider(), new Bundler(tmp3), mongod2.getUri(), undefined, {
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
             (node as any).peer = mockPeer;
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
    });

    it('Drops minority forks during Network Partition', async () => {
        // Total Network Size = 3 (Majority = 2)
        (node1.peer as any).trustedPeers = ['127.0.0.1:31002', '127.0.0.1:31003']; 
        (node2.peer as any).trustedPeers = ['127.0.0.1:31001', '127.0.0.1:31003'];
        
        // Node 3 suffers a Byzantine Partition and only sees Node 1 (Simulated Split Brain)
        (node3.peer as any).trustedPeers = ['127.0.0.1:31001'];
        
        const majority = node3.getMajorityCount();
        assert.strictEqual(majority, 2, 'Node 3 natively bounds a local perception majority counting correctly.');

        // Node 3 tries to formulate a rogue fork on its own isolated chain mappings natively
        node3.mempool.pendingBlocks.set('rogue_block', { eligible: true, originalTimestamp: Date.now() } as any);
        node3.mempool.eligibleForks.set('rogue_fork', { blockIds: ['rogue_block'], proposals: new Set(['127.0.0.1:31003']) } as any);
        
        await node3.consensusEngine.handleProposeFork('rogue_fork', ['rogue_block'], { peerAddress: '127.0.0.1:31003' } as any);
        
        // Assert the fork is NOT adopted because it didn't cross the threshold dynamically
        const fork = node3.mempool.eligibleForks.get('rogue_fork');
        assert.ok(!fork?.adopted, 'Partitioned node legitimately stalled preventing anomalous fork inclusion!');
    });

    it('Coordinates adoption across majority segments', async () => {
        node1.mempool.eligibleForks.set('valid_fork', { blockIds: ['valid_block'], proposals: new Set(['127.0.0.1:31001']) } as any);
        
        // Node 2 votes for Node 1's proposal forming the required majority mapping smoothly
        await node1.consensusEngine.handleProposeFork('valid_fork', ['valid_block'], { peerAddress: '127.0.0.1:31002' } as any);
        
        const fork = node1.mempool.eligibleForks.get('valid_fork');
        assert.ok(fork?.adopted, 'Primary partition dynamically scaled and mathematically executed the fork adoption over majority boundaries.');
    });
});
