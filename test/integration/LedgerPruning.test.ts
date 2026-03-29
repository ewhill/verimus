import { mkdtempSync } from 'fs';
import assert from 'node:assert';
import test from 'node:test';
import { tmpdir } from 'os';
import { join } from 'path';

import { MongoMemoryServer } from 'mongodb-memory-server';

import { BLOCK_TYPES } from '../../constants';
import { generateRSAKeyPair, hashData, signData } from '../../crypto_utils/CryptoUtils';
import PeerNode from '../../peer_node/PeerNode';
import { createMock } from '../../test/utils/TestUtils';
import type { Block, TransactionPayload } from '../../types';

test('Integration: Phase 6 Ledger Pruning & O(1) Checkpoint Scalability', async () => {
    const testDir = mkdtempSync(join(tmpdir(), 'verimus-prune-test-'));
    const keys = generateRSAKeyPair();
    let node: PeerNode | null = null;
    let mongod: MongoMemoryServer | null = null;

    try {
        mongod = await MongoMemoryServer.create();
        node = new PeerNode(0, [], null, null, mongod.getUri(), '127.0.0.1', {
            publicKeyPath: join(testDir, 'peer.pub'),
            privateKeyPath: join(testDir, 'peer.pem'),
            signaturePath: join(testDir, 'peer.sig'),
            publicKey: keys.publicKey,
            privateKey: keys.privateKey,
            signature: 'MOCK_SIG'
        }, testDir);
        await node.init();

        node.publicKey = keys.publicKey;
        node.privateKey = keys.privateKey;

        // 1. Manually synthesize 999,999 bounds
        // Inject a base transaction that gives peer 1000 tokens. 
        // This validates the incremental `balances` tracking hook dynamically.
        const seedPayload: TransactionPayload = {
            senderId: 'SYSTEM',
            recipientId: node.publicKey,
            amount: 1000,
            senderSignature: 'MOCK_SYS_SIG'
        };
        const seedSig = signData(JSON.stringify(seedPayload), node.privateKey);
        
        const seedBlock: Block = {
            metadata: { index: 999999, timestamp: Date.now() },
            type: BLOCK_TYPES.TRANSACTION,
            payload: seedPayload,
            publicKey: node.publicKey,
            signature: seedSig as string,
            hash: hashData(seedSig as string)
        };
        
        await node.ledger.addBlockToChain(seedBlock);
        
        await new Promise(res => setTimeout(res, 50));
        
        const initialBal = await node.consensusEngine.walletManager.calculateBalance(node.publicKey);
        assert.strictEqual(initialBal, 1000, 'Incremental state mathematically mapped 1000 bounds efficiently.');

        // 2. Cross the 1,000,000 Epoch Boundary
        // Formulate exactly Block 1,000,000 and push into the ConsensusEngine mempool
        const epochPayload: TransactionPayload = {
            senderId: 'SYSTEM',
            recipientId: node.publicKey,
            amount: 500,
            senderSignature: 'MOCK_SYS_SIG'
        };
        const epochSig = signData(JSON.stringify(epochPayload), node.privateKey);
        
        const epochBlock = createMock<Block>({
            metadata: { index: 1000000, timestamp: Date.now() },
            type: BLOCK_TYPES.TRANSACTION,
            payload: epochPayload,
            publicKey: node.publicKey,
            signature: epochSig as string,
            previousHash: seedBlock.hash
        });

        const mockConn = createMock<import('../../types').PeerConnection>({ peerAddress: '0.0.0.0', send: () => { } });
        
        const checkpointEvent = new Promise<void>(resolve => {
            node!.ledger.events.on('blockAdded', (block: Block) => {
                if (block.type === BLOCK_TYPES.CHECKPOINT) {
                    resolve();
                }
            });
        });

        await node.consensusEngine.handlePendingBlock(epochBlock, mockConn, Date.now());
        
        const blockId = hashData(epochSig as string);
        await node.consensusEngine.handleVerifyBlock(blockId, epochSig as string, mockConn);

        await checkpointEvent;

        // 3. Mathematical Verification of Checkpoint Pruning
        const postEpochBal = await node.consensusEngine.walletManager.calculateBalance(node.publicKey);
        assert.strictEqual(postEpochBal, 1500, 'Balance fully preserved completely functionally through Epoch Pruning iteration bounds.');

        const blockCount = await node.ledger.collection!.countDocuments();
        assert.ok(blockCount <= 3, `Pruning execution correctly executed O(1) bounds mathematically! Blocks tracked: ${blockCount}`);

        const destroyedSeed = await node.ledger.collection!.findOne({ hash: seedBlock.hash });
        assert.strictEqual(destroyedSeed, null, 'Block 999,999 absolutely scrubbed effectively.');
        
        const checkpoint = await node.ledger.collection!.findOne({ type: BLOCK_TYPES.CHECKPOINT });
        assert.ok(checkpoint, 'State Merkle Checkpoint actively mapped uniquely.');
        
    } finally {
        if (node) {
            if (node.httpServer) {
                node.httpServer.close();
                node.httpServer.closeAllConnections();
            }
            if (node.syncEngine && node.syncEngine.syncInterval) clearInterval(node.syncEngine.syncInterval);
            if (node.peer) await node.peer.close();
            if (node.ledger && node.ledger.client) await node.ledger.client.close();
        }
        if (mongod) await mongod.stop();
    }
});
