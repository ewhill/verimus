const assert = require('assert');
const PeerNode = require('../peer_node/PeerNode');

async function runTest() {
    console.log("=== Testing 'Bridging Active State (Buffering)' ===");
    
    // Spawn a dummy node running purely from memory (no discover topology needed)
    const node = new PeerNode(9321, [], null, null, null, null, {
        ringPublicKeyPath: '../keys/ring.ring.pub',
        publicKeyPath: '../keys/peer_8001.peer.pub',
        privateKeyPath: '../keys/peer_8001.peer.pem',
        signaturePath: '../keys/peer_8001.peer.signature'
    });
    
    // Mock the ledger to prevent real DB binds failing
    node.ledger = {
        init: async () => {},
        getLatestBlock: async () => ({ metadata: { index: 0 }, hash: 'GENESIS' }),
        isChainValid: async () => true,
        purgeChain: async () => {}
    };

    console.log("[Test] Engaging mock syncing lock on node");
    node.consensusEngine = {
        handlePendingBlock: async () => {},
        handleAdoptFork: async () => {}
    };
    node.syncEngine = {
        isSyncing: true,
        syncBuffer: []
    };


    let mockPendingHandled = 0;
    let mockAdoptHandled = 0;

    // Create a mock tracking wrapper capturing calls bypassing complex crypto validations momentarily
    const originalPending = node.consensusEngine.handlePendingBlock.bind(node.consensusEngine);
    const originalAdopt = node.consensusEngine.handleAdoptFork.bind(node.consensusEngine);
    
    node.consensusEngine.handlePendingBlock = async (b, p, ts) => {
        if (node.syncEngine.isSyncing) return await originalPending(b, p, ts);
        mockPendingHandled++; // Count successful executions post-drain safely
    };
    node.consensusEngine.handleAdoptFork = async (f, ft, p) => {
        if (node.syncEngine.isSyncing) return await originalAdopt(f, ft, p);
        mockAdoptHandled++; 
    };

    console.log("[Test] Blasting Node with synthetic 'PendingBlock' and 'AdoptFork' events mid-sync...");

    const dummyBlock = { signature: "MOCK_SIG", publicKey: "MOCK_PUB", private: "MOCK_PRIV" };
    
    // Fire events into the node explicitly mocking upstream triggers natively
    await node.consensusEngine.handlePendingBlock(dummyBlock, '127.0.0.1:8002', Date.now());
    await node.consensusEngine.handlePendingBlock(dummyBlock, '127.0.0.1:8003', Date.now());
    await node.consensusEngine.handleAdoptFork('abc1234', 'def5678', '127.0.0.1:8002');

    console.log(`[Test] Assertions whilst locked => Processed Pending: ${mockPendingHandled}, Processed Adopt: ${mockAdoptHandled}`);
    assert.strictEqual(mockPendingHandled, 0, "Failed: Handled pending block mid-sync!");
    assert.strictEqual(mockAdoptHandled, 0, "Failed: Handled adopt fork mid-sync!");
    assert.strictEqual(node.syncEngine.syncBuffer.length, 3, "Failed: Buffer did not properly cache 3 active payloads!");

    console.log("[Test] Triggering manual buffer drain mechanism simulating sync complete!");
    
    // Replicate loop exactly from `_performInitialSync` inside peerNode.js
    node.syncEngine.isSyncing = false;
    const tempQueue = [...node.syncEngine.syncBuffer];
    node.syncEngine.syncBuffer = [];
    for (const evt of tempQueue) {
        if (evt.type === 'PendingBlock') {
            await node.consensusEngine.handlePendingBlock(evt.block, evt.peerAddress, evt.timestamp);
        } else if (evt.type === 'AdoptFork') {
            await node.consensusEngine.handleAdoptFork(evt.forkId, evt.finalTipHash, evt.peerAddress);
        }
    }

    console.log(`[Test] Assertions post-drain => Processed Pending: ${mockPendingHandled}, Processed Adopt: ${mockAdoptHandled}`);
    assert.strictEqual(mockPendingHandled, 2, "Failed: Missed queued PendingBlock execution!");
    assert.strictEqual(mockAdoptHandled, 1, "Failed: Missed queued AdoptFork execution!");
    assert.strictEqual(node.syncEngine.syncBuffer.length, 0, "Failed: Buffer failed to clear!");
    
    console.log("=== Active State Buffer Test Passed successfully! ===");
}

runTest().catch(e => {
    console.error("Test Failed!", e);
    process.exit(1);
});
