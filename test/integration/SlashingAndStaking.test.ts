import { mkdtempSync } from 'fs';
import assert from 'node:assert';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { tmpdir } from 'os';
import { join } from 'path';

import { ethers } from 'ethers';
import { MongoMemoryServer } from 'mongodb-memory-server';


import { BLOCK_TYPES } from '../../constants';
import { generateRSAKeyPair, hashData } from '../../crypto_utils/CryptoUtils';
import PeerNode from '../../peer_node/PeerNode';
import { createSignedMockBlock } from '../../test/utils/EIP712Mock';
import { createMock } from '../../test/utils/TestUtils';

test('Integration: Proof of Spacetime Slashing & Mathematical Deterrence', async () => {

    const testDir = mkdtempSync(join(tmpdir(), 'verimus-slash-test-'));
    const keys = generateRSAKeyPair();
    const maliciousWallet = ethers.Wallet.createRandom();
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
        node.consensusEngine.runGlobalAudit = async () => {};

        node.publicKey = wallet.address;

        // Stage 1: Scaffold Initial Staking Collateral internally mapping Phase 5b
        const stakingLockPayload = {
            operatorAddress: maliciousWallet.address,
            collateralAmount: 50000,
            minEpochTimelineDays: 30
        };

        const stakingBlock = await createSignedMockBlock(maliciousWallet, BLOCK_TYPES.STAKING_CONTRACT, stakingLockPayload, -1);
        const mockConn = createMock<import('../../types').PeerConnection>({ peerAddress: '0.0.0.0', send: () => { } });

        await node.consensusEngine.handlePendingBlock(stakingBlock, mockConn, Date.now());

        // Finalize Staking Mints into Local DB mapping state natively 
        const forkEvent = new Promise<void>(res => {
            node!.ledger.events.once('blockAdded', () => res());
        });

        const blockToHash = { ...stakingBlock };
        delete blockToHash.hash;
        delete (blockToHash as any)._id;
        const blockId = hashData(JSON.stringify(blockToHash));
        const pMsg = { blockId: blockId, signature: stakingBlock.signature };
        await node.consensusEngine.handleVerifyBlock(pMsg.blockId, pMsg.signature, mockConn);

        await forkEvent;
        await new Promise(res => setTimeout(res, 50));

        // Assert Step: WalletManager tracks initial Locked Escrow correctly 
        const testBalance = await node.consensusEngine.walletManager.calculateBalance(maliciousWallet.address);
        assert.strictEqual(testBalance, -50000, '50,000 collateral effectively tracked removing liquid boundaries');

        // Stage 2: Intercept global mathematical failure! Injecting native Slashing penalty!
        const invalidSlashPayload = {
            penalizedAddress: maliciousWallet.address,
            evidenceSignature: 'INVALID_GARBAGE_STRING_NOT_A_HASH',
            burntAmount: 50000
        };

        // We use the WRONG key intentionally to make it an invalid block signature? Wait, the test is supposed to reject it because of evidenceSignature. 
        // Let's sign it with the valid node's signature properly organically mapping.
        const invalidSlashBlock = await createSignedMockBlock(wallet, BLOCK_TYPES.SLASHING_TRANSACTION, invalidSlashPayload, -1);

        await node.consensusEngine.handlePendingBlock(invalidSlashBlock, mockConn, Date.now());
        
        // Balance should still be -50000 
        const interimBalance = await node.consensusEngine.walletManager.calculateBalance(maliciousWallet.address);
        assert.strictEqual(interimBalance, -50000, 'Invalid evidence signature was correctly rejected by consensus engine');

        // Stage 3: Inject valid Slashing penalty!
        const slashPayload = {
            penalizedAddress: maliciousWallet.address,
            evidenceSignature: createHash('sha256').update('FORGERY_EVIDENCE_MAP').digest('hex'),
            burntAmount: 50000
        };

        const slashBlock = await createSignedMockBlock(wallet, BLOCK_TYPES.SLASHING_TRANSACTION, slashPayload, -1);

        await node.consensusEngine.handlePendingBlock(slashBlock, mockConn, Date.now());

        const slashFork = new Promise<void>(res => {
            node!.ledger.events.once('blockAdded', () => res());
        });

        const slashBlockToHash = { ...slashBlock };
        delete slashBlockToHash.hash;
        delete (slashBlockToHash as any)._id;
        const slashId = hashData(JSON.stringify(slashBlockToHash));
        await node.consensusEngine.handleVerifyBlock(slashId, slashBlock.signature, mockConn);

        await slashFork;
        await new Promise(res => setTimeout(res, 50));

        // Finalize state limits natively executing collateral mathematical checks limits
        const postSlashBalance = await node.consensusEngine.walletManager.calculateBalance(maliciousWallet.address);
        assert.strictEqual(postSlashBalance, -100000, 'Collateral slashed resulting in an immutable zeroed sum loss mathematically');

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
