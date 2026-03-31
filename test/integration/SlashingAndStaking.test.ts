import { mkdtempSync } from 'fs';
import assert from 'node:assert';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { tmpdir } from 'os';
import { join } from 'path';

import { MongoMemoryServer } from 'mongodb-memory-server';

import { BLOCK_TYPES } from '../../constants';
import { generateRSAKeyPair, hashData, signData } from '../../crypto_utils/CryptoUtils';
import PeerNode from '../../peer_node/PeerNode';
import { createMock } from '../../test/utils/TestUtils';

test('Integration: Proof of Spacetime Slashing & Mathematical Deterrence', async () => {

    const testDir = mkdtempSync(join(tmpdir(), 'verimus-slash-test-'));
    const keys = generateRSAKeyPair();
    const maliciousHostKeys = generateRSAKeyPair();
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

        node.publicKey = keys.publicKey;
        node.privateKey = keys.privateKey;

        // Stage 1: Scaffold Initial Staking Collateral internally mapping Phase 5b
        const stakingLockPayload = {
            operatorPublicKey: maliciousHostKeys.publicKey,
            collateralAmount: 50000,
            minEpochTimelineDays: 30
        };

        const stakingSig = signData(JSON.stringify(stakingLockPayload), maliciousHostKeys.privateKey);

        const stakingBlock = createMock<import('../../types').Block>({
            metadata: { index: -1, timestamp: Date.now() },
            type: BLOCK_TYPES.STAKING_CONTRACT,
            payload: stakingLockPayload,
            publicKey: maliciousHostKeys.publicKey,
            signature: stakingSig
        });
        const mockConn = createMock<import('../../types').PeerConnection>({ peerAddress: '0.0.0.0', send: () => { } });

        await node.consensusEngine.handlePendingBlock(stakingBlock, mockConn, Date.now());

        // Finalize Staking Mints into Local DB mapping state natively 
        const forkEvent = new Promise<void>(res => {
            node!.ledger.events.once('blockAdded', () => res());
        });

        const blockId = hashData(stakingSig);
        const pMsg = { blockId: blockId, signature: stakingSig };
        await node.consensusEngine.handleVerifyBlock(pMsg.blockId, pMsg.signature, mockConn);

        await forkEvent;
        await new Promise(res => setTimeout(res, 50));

        // Assert Step: WalletManager tracks initial Locked Escrow correctly 
        const testBalance = await node.consensusEngine.walletManager.calculateBalance(maliciousHostKeys.publicKey);
        assert.strictEqual(testBalance, -50000, '50,000 collateral effectively tracked removing liquid boundaries');

        // Stage 2: Intercept global mathematical failure! Injecting native Slashing penalty!
        const invalidSlashPayload = {
            penalizedPublicKey: maliciousHostKeys.publicKey,
            evidenceSignature: 'INVALID_GARBAGE_STRING_NOT_A_HASH',
            burntAmount: 50000
        };

        const invalidSlashSig = signData(JSON.stringify(invalidSlashPayload), node.privateKey);

        const invalidSlashBlock = createMock<import('../../types').Block>({
            metadata: { index: -1, timestamp: Date.now() },
            type: BLOCK_TYPES.SLASHING_TRANSACTION,
            payload: invalidSlashPayload,
            publicKey: node.publicKey,
            signature: invalidSlashSig
        });

        await node.consensusEngine.handlePendingBlock(invalidSlashBlock, mockConn, Date.now());
        
        // Balance should still be -50000 
        const interimBalance = await node.consensusEngine.walletManager.calculateBalance(maliciousHostKeys.publicKey);
        assert.strictEqual(interimBalance, -50000, 'Invalid evidence signature was correctly rejected by consensus engine');

        // Stage 3: Inject valid Slashing penalty!
        const slashPayload = {
            penalizedPublicKey: maliciousHostKeys.publicKey,
            evidenceSignature: createHash('sha256').update('FORGERY_EVIDENCE_MAP').digest('hex'),
            burntAmount: 50000
        };

        const slashSig = signData(JSON.stringify(slashPayload), node.privateKey);

        const slashBlock = createMock<import('../../types').Block>({
            metadata: { index: -1, timestamp: Date.now() },
            type: BLOCK_TYPES.SLASHING_TRANSACTION,
            payload: slashPayload,
            publicKey: node.publicKey,
            signature: slashSig
        });

        await node.consensusEngine.handlePendingBlock(slashBlock, mockConn, Date.now());

        const slashFork = new Promise<void>(res => {
            node!.ledger.events.once('blockAdded', () => res());
        });

        const slashId = hashData(slashSig);
        await node.consensusEngine.handleVerifyBlock(slashId, slashSig, mockConn);

        await slashFork;
        await new Promise(res => setTimeout(res, 50));

        // Finalize state limits natively executing collateral mathematical checks limits
        const postSlashBalance = await node.consensusEngine.walletManager.calculateBalance(maliciousHostKeys.publicKey);
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
