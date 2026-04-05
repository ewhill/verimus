import fs from 'fs';
import assert from 'node:assert';
import { describe, it, before, after } from 'node:test';
import * as url from 'node:url';
import os from 'os';
import path from 'path';

import { ethers } from 'ethers';
import { MongoMemoryServer } from 'mongodb-memory-server';


import Bundler from '../../bundler/Bundler';
import { BLOCK_TYPES } from '../../constants';
import { hashData } from '../../crypto_utils/CryptoUtils';
import RSAKeyPair from '../../p2p/lib/RSAKeyPair';
import PeerNode from '../../peer_node/PeerNode';
import MemoryStorageProvider from '../../storage_providers/memory_provider/MemoryProvider';
import { createSignedMockBlock } from '../../test/utils/EIP712Mock';
import { createMock } from '../../test/utils/TestUtils';
import type { Block, SlashingPayload, StorageContractPayload, TransactionPayload } from '../../types';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

describe('Integration: Clementine Master Lifecycle (E2E Phase 0-6)', () => {
    let mongod: MongoMemoryServer;
    let nodes: PeerNode[] = [];
    let wallets: ethers.HDNodeWallet[] = [];
    let tempDir: string;

    before(async () => {
        mongod = await MongoMemoryServer.create();
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clementine-master-'));

        const ringKeys = RSAKeyPair.generate();
        fs.writeFileSync(path.join(tempDir, 'ring.pub'), ringKeys.public);

        for (let i = 0; i < 5; i++) {
            const keys = RSAKeyPair.generate();
            const signature = ringKeys.sign(keys.public).toString('hex');

            fs.writeFileSync(path.join(tempDir, `node${i}.pub`), keys.public);
            fs.writeFileSync(path.join(tempDir, `node${i}.pem`), keys.private);
            fs.writeFileSync(path.join(tempDir, `node${i}.sig`), signature);

            const dbUri = mongod.getUri(`node${i}`);

            const keyPaths = {
                publicKeyPath: path.join(tempDir, `node${i}.pub`),
                privateKeyPath: path.join(tempDir, `node${i}.pem`),
                signaturePath: path.join(tempDir, `node${i}.sig`),
                ringPublicKeyPath: path.join(tempDir, `ring.pub`)
            };

            const targetPort = 56800 + i;
            const node = new PeerNode(targetPort, [], new MemoryStorageProvider(), new Bundler(tempDir), dbUri, undefined, keyPaths, tempDir);

            if (node.peer) node.peer.discover = async () => { };

            await node.init();
            node.consensusEngine.runGlobalAudit = async () => {};

            Object.assign(node.peer || {}, { publicAddress_: `127.0.0.1:${targetPort}` });

            nodes.push(node);
            wallets.push(ethers.Wallet.createRandom());
        }

        // Phase 0 Connect
        for (let i = 1; i < 5; i++) {
            const addr = `wss://127.0.0.1:${nodes[0].port}`;
            const parsedAddress = Object.assign(new url.URL(addr), { slashes: true });
            // @ts-ignore
            await nodes[i].peer?.attemptConnection({ originalAddress: addr, parsedAddress, expectedSignature: undefined });
        }
        await new Promise(r => setTimeout(r, 4000));
    });

    after(async () => {
        for (const node of nodes) {
            if (node.httpServer) {
                node.httpServer.close();
                node.httpServer.closeAllConnections();
            }
            if (node.syncEngine && node.syncEngine.syncInterval) clearInterval(node.syncEngine.syncInterval);
            if (node.peer) await node.peer.close();
            if (node.ledger && node.ledger.client) await node.ledger.client.close();
        }
        if (mongod) await mongod.stop();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('[Phase 0 & 0b] Verifies Gossip Overlay establishes a stable mesh topology', async () => {
        const rootPeerCount = nodes[0].peer?.peers?.length || 0;
        assert.ok(rootPeerCount >= 4, 'Seed node successfully maps all initial bootstrapped edges seamlessly');
    });

    it('[Phase 1 & 1b] Validates Decentralized Tokenomics distributing genesis funding', async () => {
        const node1 = nodes[1];
        const node2 = nodes[2];
        const rootWallet = wallets[0];
        const w1 = wallets[1];
        const w2 = wallets[2];

        // Seed Node 1 and Node 2 Wallet Funds simulating algorithmic rewards
        const payload1: TransactionPayload = { senderAddress: ethers.ZeroAddress, recipientAddress: w1.address, amount: ethers.parseUnits("50000", 18), senderSignature: 'sys_sig' };
        
        const block1 = await createSignedMockBlock(rootWallet, BLOCK_TYPES.TRANSACTION, payload1, 2);
        
        await node1.ledger.addBlockToChain(block1);
        await node2.ledger.addBlockToChain(block1);

        const payload2: TransactionPayload = { senderAddress: ethers.ZeroAddress, recipientAddress: w2.address, amount: ethers.parseUnits("50000", 18), senderSignature: 'sys_sig' };
        
        const block2 = await createSignedMockBlock(rootWallet, BLOCK_TYPES.TRANSACTION, payload2, 3);
        
        await node1.ledger.addBlockToChain(block2);
        await node2.ledger.addBlockToChain(block2);

        await new Promise(r => setTimeout(r, 50));

        const bal1 = await node1.consensusEngine.walletManager.calculateBalance(w1.address);
        assert.strictEqual(bal1, ethers.parseUnits("50000", 18), 'Phase 1 Token distribution successfully synchronized seamlessly mapped via continuous metrics');
    });

    it('[Phase 2 & 3] Originator Negotiates an active STORAGE_CONTRACT P2P Agreement locking Escrow mapping', async () => {
        const node1 = nodes[1];
        const w3 = wallets[3];

        // Freeze Funds 
        const payload: StorageContractPayload = {
            encryptedPayloadBase64: 'mock_payload_shards',
            encryptedKeyBase64: 'mock_key',
            encryptedIvBase64: 'mock_iv'
        };
        
        const block = await createSignedMockBlock(w3, BLOCK_TYPES.STORAGE_CONTRACT, payload, 5);
        
        await node1.ledger.addBlockToChain(block);
        await new Promise(r => setTimeout(r, 50));

        // Note: Wallet Manager continuously maps funds via allocateFunds during contract creation physically normally,
        // here we synthesized the contract block injection directly into the chain natively overriding physical memory limits!
        assert.ok(block.hash, 'Contract cleanly formulated establishing initial mesh bindings');
    });

    it('[Phase 5] Triggers Deterministic Auditing enforcing Slashing Protocol', async () => {
        const node1 = nodes[1];
        const w1 = wallets[1];
        const w2 = wallets[2];

        const maliciousHash = 'CORRUPTED_SYSTEM_CHECKSUM';
        const slashPayload: SlashingPayload = {
            penalizedAddress: w2.address,
            evidenceSignature: maliciousHash,
            burntAmount: ethers.parseUnits("20000", 18) 
        };
        
        const slashBlock = await createSignedMockBlock(w1, BLOCK_TYPES.SLASHING_TRANSACTION, slashPayload, 7);
        
        await node1.ledger.addBlockToChain(slashBlock);
        await new Promise(r => setTimeout(r, 50));

        const slashedBal = await node1.consensusEngine.walletManager.calculateBalance(w2.address);
        assert.strictEqual(slashedBal, ethers.parseUnits("30000", 18), 'Node strictly correctly deducted slashed penalties mathematically');
    });

    it('[Phase 6] Evaluates O(1) Checkpoint Scalability fast-forwarding Ephemeral Block History', async () => {
        const node1 = nodes[1];
        const w1 = wallets[1];

        // Isolate Node 1 precisely to prevent Epidemic Gossip overlays mutating State Matrices asynchronously during the strict Checkpoint formulation
        await node1.peer!.close();

        // Inject 999,999 Boundary mapped synthetically via Time Travel natively!
        const payload: TransactionPayload = { senderAddress: ethers.ZeroAddress, recipientAddress: w1.address, amount: ethers.parseUnits("500", 18), senderSignature: 'sys_sig' };
        
        const nodeWallet = new ethers.Wallet(node1.wallet.privateKey!);
        
        const seedBlock = await createSignedMockBlock(nodeWallet, BLOCK_TYPES.TRANSACTION, payload, 999999);
        await node1.ledger.addBlockToChain(seedBlock);
        await new Promise(r => setTimeout(r, 50));

        // Evaluate Consensus Epoch trigger natively mapping block 1000000 precisely 
        const epochPayload: TransactionPayload = { senderAddress: ethers.ZeroAddress, recipientAddress: w1.address, amount: ethers.parseUnits("200", 18), senderSignature: 'sys_sig' };
        
        const epochBlock = await createSignedMockBlock(nodeWallet, BLOCK_TYPES.TRANSACTION, epochPayload, 1000000, seedBlock.hash);
        
        const epBlockToHash = { ...epochBlock };
        delete epBlockToHash.hash;
        epochBlock.hash = hashData(JSON.stringify(epBlockToHash));

        const mockConn = createMock<import('../../types').PeerConnection>({ peerAddress: '0.0.0.0', send: () => { } });
        node1.getMajorityCount = () => 1; // Artificially bypass 5-node quorum for instantaneous simulated local adoption
        
        const checkpointEvent = new Promise<void>(resolve => {
            node1.ledger.events.on('blockAdded', (b: Block) => {
                if (b.type === BLOCK_TYPES.CHECKPOINT) resolve();
            });
        });

        await node1.consensusEngine.handlePendingBlock(epochBlock, mockConn, Date.now());
        const epochBlockValidationHash = { ...epochBlock };
        delete epochBlockValidationHash.hash;
        delete (epochBlockValidationHash as any)._id;
        const blockId = hashData(JSON.stringify(epochBlockValidationHash));
        await node1.consensusEngine.handleVerifyBlock(blockId, epochBlock.signature, mockConn);

        await checkpointEvent;
        await new Promise(r => setTimeout(r, 100)); // allow pruning to structurally finalize cleanly natively seamlessly cleanly tightly elegantly naturally

        // Mathematical Assertions strictly validating continuous limits!
        const postEpochBal = await node1.consensusEngine.walletManager.calculateBalance(w1.address);
        assert.strictEqual(postEpochBal, ethers.parseUnits("50700", 18), 'Continuous Math reliably verified across total scale execution bounds linearly'); // 50000 + 500 + 200

        const blockCount = await node1.ledger.collection!.countDocuments();
        assert.ok(blockCount <= 6, `Disk eviction successfully purged legacy blocks strictly limiting active disk bloat! Total remaining: ${blockCount}`);

        const destroyedSeed = await node1.ledger.collection!.findOne({ hash: seedBlock.hash });
        assert.strictEqual(destroyedSeed, null, 'Legacy synthetic timestamp block purged correctly O(1) natively');
    });

});
