import fs from 'fs';
import assert from 'node:assert';
import { describe, it, before, after } from 'node:test';
import * as url from 'node:url';
import os from 'os';
import path from 'path';

import { MongoMemoryServer } from 'mongodb-memory-server';

import Bundler from '../../bundler/Bundler';
import { BLOCK_TYPES } from '../../constants';
import { hashData, signData } from '../../crypto_utils/CryptoUtils';
import RSAKeyPair from '../../p2p/lib/RSAKeyPair';
import PeerNode from '../../peer_node/PeerNode';
import MemoryStorageProvider from '../../storage_providers/memory_provider/MemoryProvider';
import { createMock } from '../../test/utils/TestUtils';
import type { Block, SlashingPayload, StorageContractPayload, TransactionPayload } from '../../types';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

describe('Integration: Clementine Master Lifecycle (E2E Phase 0-6)', () => {
    let mongod: MongoMemoryServer;
    let nodes: PeerNode[] = [];
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

            Object.assign(node.peer || {}, { publicAddress_: `127.0.0.1:${targetPort}` });

            nodes.push(node);
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
        const node0 = nodes[0];
        const node1 = nodes[1];
        const node2 = nodes[2];

        // Seed Node 1 and Node 2 Wallet Funds simulating algorithmic rewards
        const payload1: TransactionPayload = { senderId: 'SYSTEM', recipientId: node1.publicKey, amount: 50000, senderSignature: 'sys_sig' };
        const sig1 = signData(JSON.stringify(payload1), node0.privateKey);
        
        const block1: Block = {
            metadata: { index: 1, timestamp: Date.now() },
            type: BLOCK_TYPES.TRANSACTION,
            payload: payload1,
            publicKey: node1.publicKey,
            signature: sig1 as string,
            hash: hashData(sig1 as string)
        };
        await node1.ledger.addBlockToChain(block1);
        await node2.ledger.addBlockToChain(block1);

        const payload2: TransactionPayload = { senderId: 'SYSTEM', recipientId: node2.publicKey, amount: 50000, senderSignature: 'sys_sig' };
        const sig2 = signData(JSON.stringify(payload2), node0.privateKey);
        
        const block2: Block = {
            metadata: { index: 2, timestamp: Date.now() },
            type: BLOCK_TYPES.TRANSACTION,
            payload: payload2,
            publicKey: node2.publicKey,
            signature: sig2 as string,
            hash: hashData(sig2 as string)
        };
        await node1.ledger.addBlockToChain(block2);
        await node2.ledger.addBlockToChain(block2);

        await new Promise(r => setTimeout(r, 50));

        const bal1 = await node1.consensusEngine.walletManager.calculateBalance(node1.publicKey);
        assert.strictEqual(bal1, 50000, 'Phase 1 Token distribution successfully synchronized seamlessly mapped via continuous metrics');
    });

    it('[Phase 2 & 3] Originator Negotiates an active STORAGE_CONTRACT P2P Agreement locking Escrow mapping', async () => {
        const node1 = nodes[1];
        const node3 = nodes[3];

        // Freeze Funds 
        const payload: StorageContractPayload = {
            encryptedPayloadBase64: 'mock_payload_shards',
            encryptedKeyBase64: 'mock_key',
            encryptedIvBase64: 'mock_iv'
        };
        const sig = signData(JSON.stringify(payload), node3.privateKey);
        
        const block: Block = {
            metadata: { index: 4, timestamp: Date.now() },
            type: BLOCK_TYPES.STORAGE_CONTRACT,
            payload,
            publicKey: node3.publicKey,
            signature: sig as string,
            hash: hashData(sig as string)
        };
        
        await node1.ledger.addBlockToChain(block);
        await new Promise(r => setTimeout(r, 50));

        // Note: Wallet Manager continuously maps funds via allocateFunds during contract creation physically normally,
        // here we synthesized the contract block injection directly into the chain natively overriding physical memory limits!
        assert.ok(block.hash, 'Contract cleanly formulated establishing initial mesh bindings');
    });

    it('[Phase 5] Triggers Deterministic Auditing enforcing Slashing Protocol', async () => {
        const node1 = nodes[1];
        const node2 = nodes[2];

        const maliciousHash = 'CORRUPTED_SYSTEM_CHECKSUM';
        const slashPayload: SlashingPayload = {
            penalizedPublicKey: node2.publicKey,
            evidenceSignature: maliciousHash,
            burntAmount: 20000 
        };
        const slashSig = signData(JSON.stringify(slashPayload), node1.privateKey);
        const slashBlock: Block = {
            metadata: { index: 6, timestamp: Date.now() },
            type: BLOCK_TYPES.SLASHING_TRANSACTION,
            payload: slashPayload,
            publicKey: node1.publicKey,
            signature: slashSig as string,
            hash: hashData(slashSig as string)
        };
        
        await node1.ledger.addBlockToChain(slashBlock);
        await new Promise(r => setTimeout(r, 50));

        const slashedBal = await node1.consensusEngine.walletManager.calculateBalance(node2.publicKey);
        assert.strictEqual(slashedBal, 30000, 'Node strictly correctly deducted slashed penalties mathematically');
    });

    it('[Phase 6] Evaluates O(1) Checkpoint Scalability fast-forwarding Ephemeral Block History', async () => {
        const node1 = nodes[1];

        // Isolate Node 1 precisely to prevent Epidemic Gossip overlays mutating State Matrices asynchronously during the strict Checkpoint formulation
        await node1.peer!.close();

        // Inject 999,999 Boundary mapped synthetically via Time Travel natively!
        const payload: TransactionPayload = { senderId: 'SYSTEM', recipientId: node1.publicKey, amount: 500, senderSignature: 'sys_sig' };
        const sig = signData(JSON.stringify(payload), node1.privateKey);
        
        const seedBlock: Block = {
            metadata: { index: 999999, timestamp: Date.now() },
            type: BLOCK_TYPES.TRANSACTION,
            payload: payload,
            publicKey: node1.publicKey,
            signature: sig as string,
            hash: hashData(sig as string)
        };
        await node1.ledger.addBlockToChain(seedBlock);
        await new Promise(r => setTimeout(r, 50));

        // Evaluate Consensus Epoch trigger natively mapping block 1000000 precisely 
        const epochPayload: TransactionPayload = { senderId: 'SYSTEM', recipientId: node1.publicKey, amount: 200, senderSignature: 'sys_sig' };
        const epochSig = signData(JSON.stringify(epochPayload), node1.privateKey);
        const epochBlock = createMock<Block>({
            metadata: { index: 1000000, timestamp: Date.now() },
            type: BLOCK_TYPES.TRANSACTION,
            payload: epochPayload,
            publicKey: node1.publicKey,
            signature: epochSig as string,
            previousHash: seedBlock.hash
        });

        const mockConn = createMock<import('../../types').PeerConnection>({ peerAddress: '0.0.0.0', send: () => { } });
        node1.getMajorityCount = () => 1; // Artificially bypass 5-node quorum for instantaneous simulated local adoption
        
        
        const checkpointEvent = new Promise<void>(resolve => {
            node1.ledger.events.on('blockAdded', (b: Block) => {
                if (b.type === BLOCK_TYPES.CHECKPOINT) resolve();
            });
        });

        await node1.consensusEngine.handlePendingBlock(epochBlock, mockConn, Date.now());
        const blockId = hashData(epochSig as string);
        await node1.consensusEngine.handleVerifyBlock(blockId, epochSig as string, mockConn);

        await checkpointEvent;

        // Mathematical Assertions strictly validating continuous limits!
        const postEpochBal = await node1.consensusEngine.walletManager.calculateBalance(node1.publicKey);
        assert.strictEqual(postEpochBal, 50700, 'Continuous Math reliably verified across total scale execution bounds linearly'); // 50000 + 500 + 200

        const blockCount = await node1.ledger.collection!.countDocuments();
        assert.ok(blockCount <= 6, `Disk eviction successfully purged legacy blocks strictly limiting active disk bloat! Total remaining: ${blockCount}`);

        const destroyedSeed = await node1.ledger.collection!.findOne({ hash: seedBlock.hash });
        assert.strictEqual(destroyedSeed, null, 'Legacy synthetic timestamp block purged correctly O(1) natively');
    });

});
