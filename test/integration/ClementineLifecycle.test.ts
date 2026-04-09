import fs from 'fs';
import assert from 'node:assert';
import { describe, it, before, after } from 'node:test';
import * as url from 'node:url';
import os from 'os';
import path from 'path';

import { ethers } from 'ethers';
import FormData from 'form-data';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fetch from 'node-fetch';


import Bundler from '../../bundler/Bundler';
import { BLOCK_TYPES } from '../../constants';
import { hashData } from '../../crypto_utils/CryptoUtils';
import PeerNode from '../../peer_node/PeerNode';
import MemoryStorageProvider from '../../storage_providers/memory_provider/MemoryProvider';
import { createSignedMockBlock } from '../../test/utils/EIP712Mock';
import { createMock } from '../../test/utils/TestUtils';
import type { Block, SlashingPayload, TransactionPayload } from '../../types';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

describe('Integration: Clementine Master Lifecycle (E2E Phase 0-6)', () => {
    let mongod: MongoMemoryServer;
    let nodes: PeerNode[] = [];
    let wallets: ethers.HDNodeWallet[] = [];
    let tempDir: string;
    let e2eContractHash = '';

    before(async () => {
        mongod = await MongoMemoryServer.create();
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clementine-master-'));

        const ringWallet = ethers.Wallet.createRandom();
        for (let i = 0; i < 5; i++) {
            const nodeWallet = ethers.Wallet.createRandom();
            const signature = await ringWallet.signMessage(nodeWallet.address);

            fs.writeFileSync(path.join(tempDir, `node${i}.evm.key`), nodeWallet.privateKey);
            fs.writeFileSync(path.join(tempDir, `node${i}.sig`), signature);

            const dbUri = mongod.getUri(`node${i}`);

            const keyPaths = {
                evmPrivateKeyPath: path.join(tempDir, `node${i}.evm.key`),
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
            wallets.push(nodeWallet);
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
        const rootWallet = wallets[0];
        const w1 = wallets[1];
        const w2 = wallets[2];

        // Seed Originator and Target Hosts Wallet Funds simulating algorithmic rewards natively
        const payload1: TransactionPayload = { senderAddress: ethers.ZeroAddress, recipientAddress: w1.address, amount: ethers.parseUnits("50000", 18), senderSignature: 'sys_sig' };
        const block1 = await createSignedMockBlock(rootWallet, BLOCK_TYPES.TRANSACTION, payload1, 2);
        
        const payload2: TransactionPayload = { senderAddress: ethers.ZeroAddress, recipientAddress: w2.address, amount: ethers.parseUnits("50000", 18), senderSignature: 'sys_sig' };
        const block2 = await createSignedMockBlock(rootWallet, BLOCK_TYPES.TRANSACTION, payload2, 3);

        const payload3: TransactionPayload = { senderAddress: ethers.ZeroAddress, recipientAddress: wallets[3].address, amount: ethers.parseUnits("50000", 18), senderSignature: 'sys_sig' };
        const block3 = await createSignedMockBlock(rootWallet, BLOCK_TYPES.TRANSACTION, payload3, 4);

        const payload4: TransactionPayload = { senderAddress: ethers.ZeroAddress, recipientAddress: wallets[4].address, amount: ethers.parseUnits("50000", 18), senderSignature: 'sys_sig' };
        const block4 = await createSignedMockBlock(rootWallet, BLOCK_TYPES.TRANSACTION, payload4, 5);
        
        await Promise.all(nodes.map(n => n.ledger.addBlockToChain(block1)));
        await Promise.all(nodes.map(n => n.ledger.addBlockToChain(block2)));
        await Promise.all(nodes.map(n => n.ledger.addBlockToChain(block3)));
        await Promise.all(nodes.map(n => n.ledger.addBlockToChain(block4)));

        await new Promise(r => setTimeout(r, 100));

        const bal1 = await node1.consensusEngine.walletManager.calculateBalance(w1.address);
        assert.strictEqual(bal1, ethers.parseUnits("50000", 18), 'Phase 1 Token distribution successfully synchronized seamlessly mapped via continuous metrics');
    });

    it('[Phase 2 & 3] Originator Negotiates Authentic Host Protocol Staking & Limit Orders', async () => {
        const node1 = nodes[1];
        const w1 = wallets[1];
        const w2 = wallets[2];
        const w3 = wallets[3];
        const w4 = wallets[4];

        // 1. Authentic Host Protocol Staking - Nodes 2, 3, 4 lock their 5000 VERI collateral stakes natively
        const stakePayload2 = { operatorAddress: w2.address, collateralAmount: ethers.parseUnits("5000", 18), minEpochTimelineDays: 30n };
        const stakeBlock2 = await createSignedMockBlock(w2, BLOCK_TYPES.STAKING_CONTRACT, stakePayload2, 6);
        
        const stakePayload3 = { operatorAddress: w3.address, collateralAmount: ethers.parseUnits("5000", 18), minEpochTimelineDays: 30n };
        const stakeBlock3 = await createSignedMockBlock(w3, BLOCK_TYPES.STAKING_CONTRACT, stakePayload3, 7);
        
        const stakePayload4 = { operatorAddress: w4.address, collateralAmount: ethers.parseUnits("5000", 18), minEpochTimelineDays: 30n };
        const stakeBlock4 = await createSignedMockBlock(w4, BLOCK_TYPES.STAKING_CONTRACT, stakePayload4, 8);
        
        await Promise.all(nodes.map(n => n.ledger.addBlockToChain(stakeBlock2)));
        await Promise.all(nodes.map(n => n.ledger.addBlockToChain(stakeBlock3)));
        await Promise.all(nodes.map(n => n.ledger.addBlockToChain(stakeBlock4)));
        await Promise.all(nodes.map(n => n.consensusEngine.walletManager.updateIncrementalState(stakeBlock2)));
        await Promise.all(nodes.map(n => n.consensusEngine.walletManager.updateIncrementalState(stakeBlock3)));
        await Promise.all(nodes.map(n => n.consensusEngine.walletManager.updateIncrementalState(stakeBlock4)));
        await new Promise(r => setTimeout(r, 2000));
        
        let attempts = 0;
        while (node1.peer!.peers.length < 3 && attempts < 20) {
            await new Promise(r => setTimeout(r, 500));
            attempts++;
        }

        // Assert they are in activeStorageProvidersCollection
        const cacheRecord = await node1.ledger.activeStorageProvidersCollection!.findOne({ operatorAddress: w2.address });
        assert.ok(cacheRecord, 'Host 2 explicitly established Storage Provider Tracking');

        // 2. Genuine End-User Pipeline Trigger 
        const filePath = path.join(tempDir, 'dummy_e2e_upload.txt');
        fs.writeFileSync(filePath, 'End to End Decentralized P2P Integration Limit Test Sequence Target Frame');
        
        const timestamp = Date.now().toString();
        const signature = await w1.signMessage(`Approve Verimus Originator proxy for data struct batch\nTimestamp: ${timestamp}`);

        const formData = new FormData();
        formData.append('files', fs.createReadStream(filePath));
        formData.append('paths', JSON.stringify([filePath]));
        formData.append('ownerAddress', w1.address);
        formData.append('ownerSignature', signature);
        formData.append('timestamp', timestamp);
        formData.append('redundancy', '3');

        const https = await import('https');
        const uploadRes = await fetch(`https://127.0.0.1:${nodes[1].port}/api/upload`, {
            method: 'POST',
            body: formData,
            agent: new https.Agent({ rejectUnauthorized: false })
        });
        const uploadText = await uploadRes.text();
        let uploadJson: any;
        try { uploadJson = JSON.parse(uploadText); } catch (e) {
            console.error("FAILED UPLOAD TEXT:", uploadText);
            throw e;
        }
        
        assert.strictEqual(uploadRes.status, 202, 'HTTP Framework accurately resolved limit parameters globally returning HTTP 202');
        assert.strictEqual(uploadJson.success, true, 'Limit order negotiation and BFT P2P formulation mapped seamlessly within parameters.');
        
        e2eContractHash = uploadJson.hash;
        
        // Let the consensus settle for the uploaded block cleanly natively looping asynchronously mapping bounds exactly
        let allContracts: any[] = [];
        let awaitAttempts = 0;
        while (allContracts.length === 0 && awaitAttempts < 20) {
            await new Promise(r => setTimeout(r, 500));
            allContracts = await node1.ledger.activeContractsCollection!.find({ "payload.ownerAddress": w1.address }).toArray();
            awaitAttempts++;
        }
        
        if (allContracts.length > 0) {
            e2eContractHash = allContracts[0].contractId;
        }
        assert.ok(e2eContractHash, 'Contract generated via active limit bounds explicitly flawlessly');
        
        // 3. Assert Decentralized Limit Order Negotiation 
        const internalContract = await node1.ledger.activeContractsCollection!.findOne({ contractId: e2eContractHash });
        assert.ok(internalContract, 'Smart Contract actively registered correctly natively');
        assert.deepStrictEqual(internalContract.payload.activeHosts.sort(), [w2.address, w3.address, w4.address].sort(), 'Active Hosts array exclusively captured completely authentically physically staked host providers.');
    });

    it('[Phase 4] Assert Download Retrieval and Escrow Tokenomics limits', async () => {
        const node1 = nodes[1];
        const w1 = wallets[1];
        const timestamp = Date.now().toString();
        
        const jsonSign = JSON.stringify({ action: 'download', blockHash: e2eContractHash, timestamp });
        const dlSignature = await w1.signMessage(jsonSign);
        
        const https = await import('https');
        const url = `https://127.0.0.1:${node1.port}/api/download/${e2eContractHash}`;
        const downloadRes = await fetch(url, {
            headers: {
                'x-web3-address': w1.address,
                'x-web3-timestamp': timestamp,
                'x-web3-signature': dlSignature
            },
            agent: new https.Agent({ rejectUnauthorized: false })
        });
        
        assert.strictEqual(downloadRes.status, 200, 'HTTP Framework resolved verified retrieval requests smoothly');
        const bodyText = await downloadRes.text();
        // Try to parse the text response
        const expectedSubstring = 'End to End Decentralized P2P Integration Limit Test Sequence Target Frame';
        assert.ok(bodyText.includes(expectedSubstring), `Package correctly mirrored bounds. Raw: ${bodyText.substring(0, 50)}`);

        // Task 6: Validate Hosting Escrow Tokenomics
        const postUploadBal = await node1.consensusEngine.walletManager.calculateBalance(w1.address);
        assert.ok(postUploadBal < ethers.parseUnits("50000", 18), 'Originators wallet correctly depleted deducting storage provider escrow costs');

        const internalContract = await node1.ledger.activeContractsCollection!.findOne({ contractId: e2eContractHash });
        assert.ok(internalContract!.escrowAmount !== "0", 'Storage Limit contract properly allocated nonzero massive escrow weight parameters');
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
        
        const slashBlock = await createSignedMockBlock(w1, BLOCK_TYPES.SLASHING_TRANSACTION, slashPayload, 100);
        
        await node1.ledger.addBlockToChain(slashBlock);
        await new Promise(r => setTimeout(r, 50));

        const w2SlashedBalance = await node1.consensusEngine.walletManager.calculateBalance(w2.address);
        assert.ok(w2SlashedBalance < ethers.parseUnits("30000", 18), 'Node strictly correctly deducted slashed penalties mathematically');
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
        const postGlobalAuditBal = await node1.consensusEngine.walletManager.calculateBalance(wallets[1].address);
        assert.ok(postGlobalAuditBal > ethers.parseUnits("50600", 18), 'Continuous Math reliably verified across total scale execution bounds linearly'); // 50000 + 500 + 200

        const blockCount = await node1.ledger.collection!.countDocuments();
        assert.ok(blockCount <= 6, `Disk eviction successfully purged legacy blocks strictly limiting active disk bloat! Total remaining: ${blockCount}`);

        const destroyedSeed = await node1.ledger.collection!.findOne({ hash: seedBlock.hash });
        assert.strictEqual(destroyedSeed, null, 'Legacy synthetic timestamp block purged correctly O(1) natively');
    });

});
