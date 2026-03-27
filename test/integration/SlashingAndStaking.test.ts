import { mkdtempSync } from 'fs';
import assert from 'node:assert';
import test from 'node:test';
import { tmpdir } from 'os';
import { join } from 'path';

import { MongoMemoryServer } from 'mongodb-memory-server';

import { BLOCK_TYPES } from '../../constants';
import { generateRSAKeyPair, hashData, signData } from '../../crypto_utils/CryptoUtils';
import PeerNode from '../../peer_node/PeerNode';


test('Integration: Proof of Spacetime Slashing & Mathematical Deterrence', async (_unusedT: any) => {

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

        node.publicKey = keys.publicKey;
        node.privateKey = keys.privateKey;

        // Stage 1: Scaffold Initial Staking Collateral internally mapping Phase 5b
        const stakingLockPayload = {
            operatorPublicKey: maliciousHostKeys.publicKey,
            collateralAmount: 50000,
            minEpochTimelineDays: 30
        };

        const stakingSig = signData(JSON.stringify(stakingLockPayload), maliciousHostKeys.privateKey);
        
        const stakingBlock = {
            metadata: { index: -1, timestamp: Date.now() },
            type: BLOCK_TYPES.STAKING_CONTRACT,
            payload: stakingLockPayload,
            publicKey: maliciousHostKeys.publicKey,
            signature: stakingSig
        };

        await node.consensusEngine.handlePendingBlock(stakingBlock as any, { peerAddress: '0.0.0.0', send: () => { } } as any, Date.now());

        // Finalize Staking Mints into Local DB mapping state natively 
        const forkEvent = new Promise<void>(res => {
            node!.ledger.events.once('blockAdded', () => res());
        });

        const blockId = hashData(stakingSig);
        const pMsg = { blockId: blockId, signature: stakingSig };
        await node.consensusEngine.handleVerifyBlock(pMsg.blockId, pMsg.signature, { peerAddress: '0.0.0.0', send: () => { } } as any);

        await forkEvent;

        // Assert Step: WalletManager tracks initial Locked Escrow correctly 
        const testBalance = await node.consensusEngine.walletManager.calculateBalance(maliciousHostKeys.publicKey);
        assert.strictEqual(testBalance, -50000, '50,000 collateral effectively tracked removing liquid boundaries');

        // Stage 2: Intercept global mathematical failure! Injecting native Slashing penalty!
        const slashPayload = {
            penalizedPublicKey: maliciousHostKeys.publicKey,
            evidenceSignature: 'FORGERY_EVIDENCE_MAP',
            burntAmount: 50000
        };

        const slashSig = signData(JSON.stringify(slashPayload), node.privateKey);

        const slashBlock = {
            metadata: { index: -1, timestamp: Date.now() },
            type: BLOCK_TYPES.SLASHING_TRANSACTION,
            payload: slashPayload,
            publicKey: node.publicKey,
            signature: slashSig
        };

        await node.consensusEngine.handlePendingBlock(slashBlock as any, { peerAddress: '0.0.0.0', send: () => { } } as any, Date.now());

        const slashFork = new Promise<void>(res => {
            node!.ledger.events.once('blockAdded', () => res());
        });

        const slashId = hashData(slashSig);
        await node.consensusEngine.handleVerifyBlock(slashId, slashSig, { peerAddress: '0.0.0.0', send: () => { } } as any);

        await slashFork;

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
