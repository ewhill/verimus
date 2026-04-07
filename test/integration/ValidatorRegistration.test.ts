import { mkdtempSync, rmSync } from 'fs';
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { tmpdir } from 'os';
import { join } from 'path';

import { ethers } from 'ethers';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { BLOCK_TYPES, EPOCH_LENGTH } from '../../constants';
import { generateRSAKeyPair } from '../../crypto_utils/CryptoUtils';
import PeerNode from '../../peer_node/PeerNode';
import { createSignedMockBlock } from '../../test/utils/EIP712Mock';
import { NodeRole } from '../../types/NodeRole';
import WalletManager from '../../wallet_manager/WalletManager';

describe('Integration: On-Chain Validator Registry Transitions', () => {

    it('Coordinates epoch-driven deterministic BFT scaling properly', async () => {
        const testDir = mkdtempSync(join(tmpdir(), 'verimus-epoch-test-'));
        let mongod = await MongoMemoryServer.create();
        let node: PeerNode;
        
        try {
            const keys = generateRSAKeyPair();
            node = new PeerNode(32000, [], null, null, mongod.getUri(), '127.0.0.1', {
                publicKeyPath: join(testDir, `peer.pub`),
                privateKeyPath: join(testDir, `peer.pem`),
                signaturePath: join(testDir, `peer.sig`),
                publicKey: keys.publicKey,
                privateKey: keys.privateKey,
                signature: 'MOCK_SIG'
            }, testDir, true, [NodeRole.ORIGINATOR, NodeRole.VALIDATOR]);
            
            node.consensusEngine.runGlobalAudit = async () => {};
            
            await node.ledger.init(32000);
            node.walletManager = new WalletManager(node.ledger);
            await (node as any).loadOwnedBlocksCache?.();
            Object.assign(node, { 
                peer: {
                    peers: [],
                    broadcast: async () => {},
                    bind: () => ({ to: () => {} }),
                    close: async () => {}
                }
            });

            assert.strictEqual(node.getMajorityCount(), 1, "Early network strictly defaults safely to 1 validator limit.");

            const stakingWallet = ethers.Wallet.createRandom();
            const valPayload = {
                validatorAddress: stakingWallet.address,
                stakeAmount: 1000n,
                action: 'STAKE' as 'STAKE'
            };

            const indexBeforeEpoch = EPOCH_LENGTH - 1;
            const valBlock = await createSignedMockBlock(stakingWallet, BLOCK_TYPES.VALIDATOR_REGISTRATION, valPayload, indexBeforeEpoch);
            await node.ledger.addBlockToChain(valBlock);
            
            assert.strictEqual(node.ledger.activeValidatorCountCache, 0, "Validator Count cache maintains limits perfectly without leaking into synchronous boundaries early");
            assert.strictEqual(node.getMajorityCount(), 1, "Majority limits actively maintained statically gracefully");

            const tickBlock = await createSignedMockBlock(stakingWallet, BLOCK_TYPES.TRANSACTION, { senderAddress: stakingWallet.address, senderSignature: 'sig', recipientAddress: ethers.Wallet.createRandom().address, amount: 0n }, EPOCH_LENGTH);
            await node.ledger.addBlockToChain(tickBlock);

            assert.strictEqual(node.ledger.activeValidatorCountCache, 1, "Node successfully identified modulus limits and strictly fetched active limits natively");
            assert.strictEqual(node.getMajorityCount(), 1, "Majority count of 1 active validator floor(1/2) + 1 = 1");

            const w2 = ethers.Wallet.createRandom();
            const val2 = await createSignedMockBlock(w2, BLOCK_TYPES.VALIDATOR_REGISTRATION, { validatorAddress: w2.address, stakeAmount: 100n, action: 'STAKE' }, EPOCH_LENGTH + 1);
            await node.ledger.addBlockToChain(val2);
            
            const w3 = ethers.Wallet.createRandom();
            const val3 = await createSignedMockBlock(w3, BLOCK_TYPES.VALIDATOR_REGISTRATION, { validatorAddress: w3.address, stakeAmount: 100n, action: 'STAKE' }, EPOCH_LENGTH + 2);
            await node.ledger.addBlockToChain(val3);

            const tickBlock2 = await createSignedMockBlock(stakingWallet, BLOCK_TYPES.TRANSACTION, { senderAddress: stakingWallet.address, senderSignature: 'sig', recipientAddress: ethers.Wallet.createRandom().address, amount: 0n }, EPOCH_LENGTH * 2);
            await node.ledger.addBlockToChain(tickBlock2);

            assert.strictEqual(node.ledger.activeValidatorCountCache, 3, "Node mapped all outstanding bounds structurally shifting BFT size exactly upon boundary mappings purely natively");
            assert.strictEqual(node.getMajorityCount(), 2, "BFT Majority evaluates securely scaling uniformly floor(3/2) + 1 = 2");

        } finally {
            if (node!) {
                if ((node.consensusEngine as any).triageInterval) clearInterval((node.consensusEngine as any).triageInterval);
                if ((node.consensusEngine as any).auditInterval) clearInterval((node.consensusEngine as any).auditInterval);
                if ((node.consensusEngine as any).consensusLoop) clearInterval((node.consensusEngine as any).consensusLoop);
            }
            await node!.ledger.client?.close();
            await mongod.stop();
            rmSync(testDir, { recursive: true, force: true });
        }
    });
});
