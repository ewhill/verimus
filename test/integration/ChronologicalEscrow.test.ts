import { mkdtempSync } from 'fs';
import assert from 'node:assert';
import test, { mock } from 'node:test';
import { tmpdir } from 'os';
import { join } from 'path';

import { ethers } from 'ethers';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { BLOCK_TYPES } from '../../constants';
import { generateRSAKeyPair, hashData } from '../../crypto_utils/CryptoUtils';
import PeerNode from '../../peer_node/PeerNode';
import { createSignedMockBlock } from '../../test/utils/EIP712Mock';
import { createMock } from '../../test/utils/TestUtils';

test('Integration: Chronological Escrow Epoch Tick Convergence', async () => {
    const testDir = mkdtempSync(join(tmpdir(), 'verimus-escrow-test-'));
    const keys = generateRSAKeyPair();
    const wallet = ethers.Wallet.createRandom();
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
        node.syncEngine.currentState = 'ACTIVE' as any;
        node.consensusEngine.runGlobalAudit = async () => {};

        // Mock processEpochTick explicitly to assert tracking
        const tickSpy = mock.method(node.walletManager, 'processEpochTick');

        const transactionPayload = {
            senderSignature: 'sig',
            senderAddress: wallet.address,
            recipientAddress: ethers.Wallet.createRandom().address,
            amount: 50n
        };

        const txBlock = await createSignedMockBlock(wallet, BLOCK_TYPES.TRANSACTION, transactionPayload, 99);
        const mockConn = createMock<import('../../types').PeerConnection>({ peerAddress: '0.0.0.0', send: () => { } });

        const forkEvent = new Promise<void>(res => {
            node!.ledger.events.once('blockAdded', () => res());
        });

        await node.consensusEngine.handlePendingBlock(txBlock, mockConn, Date.now());

        const blockToHash = { ...txBlock };
        delete blockToHash.hash;
        delete (blockToHash as any)._id;
        const blockId = hashData(JSON.stringify(blockToHash, (_, v) => typeof v === 'bigint' ? v.toString() : v));
        const pMsg = { blockId: blockId, signature: txBlock.signature };
        
        // Approve block
        await node.consensusEngine.handleVerifyBlock(pMsg.blockId, pMsg.signature, mockConn);

        await forkEvent;
        await new Promise(res => setTimeout(res, 100)); // allow async subscribers to complete execution

        // Assert Step: WalletManager.processEpochTick is tracked exactly mathematically
        assert.strictEqual(tickSpy.mock.callCount(), 1, 'processEpochTick must be successfully fired exactly once');
        assert.strictEqual(tickSpy.mock.calls[0].arguments[0], 99, 'processEpochTick must be passed the exact metadata index natively');

    } finally {
        if (node) await node.stop();
        if (mongod) await mongod.stop();
    }
});
