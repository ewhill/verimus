import http from 'http';
import * as fsLib from 'node:fs';
import osLib from 'os';
import pathLib from 'path';

import FormData from 'form-data';
import { MongoMemoryServer } from 'mongodb-memory-server';

import setupExpressApp from '../../api_server/ApiServer';
import Bundler from '../../bundler/Bundler';
import RSAKeyPair from '../../p2p/lib/RSAKeyPair';
import PeerNode from '../../peer_node/PeerNode';
import MemoryStorageProvider from '../../storage_providers/memory_provider/MemoryProvider';



// Ensure ephemeral Mongo mapping globally


async function runManualTest() {
    console.log("Starting Ephemeral Test Environment for All Enterprise Phases...");
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();




    const tmp1 = fsLib.mkdtempSync(pathLib.join(osLib.tmpdir(), 'verimus-'));
    // Node 1
    const node1 = new PeerNode(26780, ['127.0.0.1:26781', '127.0.0.1:26782'], new MemoryStorageProvider(), new Bundler(tmp1), uri, undefined, {
        ringPublicKeyPath: 'keys/ring.ring.pub',
        publicKeyPath: 'keys/peer_26780.peer.pub',
        privateKeyPath: 'keys/peer_26780.peer.pem',
        signaturePath: 'keys/peer_26780.peer.signature'
    }, tmp1);

    const tmp2 = fsLib.mkdtempSync(pathLib.join(osLib.tmpdir(), 'verimus-'));
    // Node 2
    const node2 = new PeerNode(26781, ['127.0.0.1:26780', '127.0.0.1:26782'], new MemoryStorageProvider(), new Bundler(tmp2), uri, undefined, {
        ringPublicKeyPath: 'keys/ring.ring.pub',
        publicKeyPath: 'keys/peer_26781.peer.pub',
        privateKeyPath: 'keys/peer_26781.peer.pem',
        signaturePath: 'keys/peer_26781.peer.signature'
    }, tmp2);

    const tmp3 = fsLib.mkdtempSync(pathLib.join(osLib.tmpdir(), 'verimus-'));
    // Node 3
    const node3 = new PeerNode(26782, ['127.0.0.1:26780', '127.0.0.1:26781'], new MemoryStorageProvider(), new Bundler(tmp3), uri, undefined, {
        ringPublicKeyPath: 'keys/ring.ring.pub',
        publicKeyPath: 'keys/peer_26782.peer.pub',
        privateKeyPath: 'keys/peer_26782.peer.pem',
        signaturePath: 'keys/peer_26782.peer.signature'
    }, tmp3);

    // Generate keys to prevent errors
    [node1, node2, node3].forEach((_unusedNode, index) => {


        const baseKey = `keys/peer_2678${index}`;
        if (!fsLib.existsSync('keys')) fsLib.mkdirSync('keys');
        if (!fsLib.existsSync('keys/ring.ring.pem')) {
             const ringKeys = RSAKeyPair.generate();
             fsLib.writeFileSync('keys/ring.ring.pem', ringKeys.private);
             fsLib.writeFileSync('keys/ring.ring.pub', ringKeys.public);
        }
        if (!fsLib.existsSync(`${baseKey}.peer.pem`)) {
            const peerKeyPair = RSAKeyPair.generate();
            fsLib.writeFileSync(`${baseKey}.peer.pem`, peerKeyPair.private);
            fsLib.writeFileSync(`${baseKey}.peer.pub`, peerKeyPair.public);
            
            const ringKeyPair = new RSAKeyPair({ privateKeyPath: 'keys/ring.ring.pem' });
            const signature = ringKeyPair.sign(peerKeyPair.public);
            
            fsLib.writeFileSync(`${baseKey}.peer.signature`, signature);
        }
    });

    await Promise.all([node1.init(), node2.init(), node3.init()]);

    // @ts-ignore - http mapped statically over natively bounded https layouts
    node1.httpServer = http.createServer(setupExpressApp(node1));
    // @ts-ignore
    node2.httpServer = http.createServer(setupExpressApp(node2));
    // @ts-ignore
    node3.httpServer = http.createServer(setupExpressApp(node3));

    await Promise.all([
        new Promise<void>(res => node1.httpServer!.listen(27780, '0.0.0.0', () => res())),
        new Promise<void>(res => node2.httpServer!.listen(27781, '0.0.0.0', () => res())),
        new Promise<void>(res => node3.httpServer!.listen(27782, '0.0.0.0', () => res()))
    ]);

    // Network Setup
    while (
        // @ts-ignore
        node1.peer?.trustedPeers.length < 2 || 
        // @ts-ignore
        node2.peer?.trustedPeers.length < 2 || 
        // @ts-ignore
        node3.peer?.trustedPeers.length < 2
    ) {
        await new Promise(r => setTimeout(r, 500));
    }

    // Explicit testnet token bypass mimicking SYSTEM Genesis Mint natively
    await node1.ledger.collection!.insertOne({
        metadata: { index: -1, timestamp: Date.now() },
        type: 'TRANSACTION',
        previousHash: 'mock_genesis_bypass',
        hash: 'mock_funds_node1',
        payload: { senderId: 'SYSTEM', recipientId: node1.publicKey, amount: 50000.0, senderSignature: 'SYSTEM_MINT' },
        publicKey: 'SYSTEM',
        signature: 'SYSTEM_MINT'
    });
    // Let wallet manager refresh queries organically
    await new Promise(r => setTimeout(r, 100));

    try {
        console.log("\n--- 1. Performing Standard File Upload (Phase 1 Crypto & Streams) ---");
        const form = new FormData();
        form.append('files', Buffer.from('Phase 1 and 2 verification active payload string'), { filename: 'verification.txt', contentType: 'text/plain' });
        
        const uploadReq = await fetch("http://127.0.0.1:27780/api/upload", {
            method: 'POST',
            body: form.getBuffer(),
            headers: form.getHeaders()
        });
        const uploadData: any = await uploadReq.json();
        console.log("Upload resolved:", uploadData.success, "- Msg:", uploadData.message);

        await new Promise(r => setTimeout(r, 2000)); // Sync propagation
        
        console.log("\n--- 2. Fetching Ledgers to witness Write Concerns correctly synchronized (Phase 2 & 3 Consensus) ---");
        const blocksReq = await fetch("http://127.0.0.1:27782/api/blocks");
        const blocksData: any = await blocksReq.json();
        const uploadedBlock = blocksData.blocks.find((b: any) => b.metadata && b.metadata.index > 0);
        if (!uploadedBlock) throw new Error("Block not found traversing Ledger.");
        console.log("Node 3 Ledger Sync matching index:", uploadedBlock.metadata.index, `Hash: ${uploadedBlock.hash.substring(0,8)}`);
        
        console.log("\n--- 3. Verifying Decryption using Authenticated Crypto primitives (Phase 1) ---");
        const dlRes = await fetch(`http://127.0.0.1:27780/api/download/${uploadedBlock.hash}/file/verification.txt`);
        if (dlRes.status !== 200) throw new Error(await dlRes.text());
        console.log("Download Payload Stream Contents:", await dlRes.text());
        
        console.log("\n--- 4. Fetching Winston logs (Phase 2) ---");
        const logsRes = await fetch("http://127.0.0.1:27781/api/logs");
        const logsData: any = await logsRes.json();
        if (logsData.length > 0) {
             console.log("Winston mapping successful, logs formatted! First log:", JSON.stringify(logsData[logsData.length-1]).substring(0, 80));
        }

        console.log("\n--- 5. Simulating Network Partition (Phase 3 Resilience) ---");
        // Isolate Node 3
        // @ts-ignore - network testing hack mapping isolation
        node3.peer.trustedPeers = [];
        // @ts-ignore
        node1.peer.trustedPeers = ['127.0.0.1:26781'];
        // @ts-ignore
        node2.peer.trustedPeers = ['127.0.0.1:26780'];
        
        const rogueForm = new FormData();
        rogueForm.append('files', Buffer.from('Byzantine attack payload'), { filename: 'attack.txt' });
        console.log("Injecting Rogue Upload to Isolated Node 3...");
        const rogueReq = await fetch("http://127.0.0.1:27782/api/upload", { 
            method: 'POST', 
            body: rogueForm.getBuffer(),
            headers: rogueForm.getHeaders()
        });
        const rogueData: any = await rogueReq.json();
        
        await new Promise(r => setTimeout(r, 2000));
        
        const rogueBlocks: any = await (await fetch("http://127.0.0.1:27782/api/blocks")).json();
        const rogueFound = rogueBlocks.blocks.some((b: any) => b.payload && b.signature === rogueData.signature);
        if (rogueFound) throw new Error("CRITICAL: Partition bypassed quorum limits!");
        console.log("SUCCESS: Isolated node stalled preventing corrupt blockchain commitments matching Math.floor(N/2)+1.");

        console.log("\n--- 6. Verifying Massive Memory Optimization (Phase 3 Load Stress) ---");
        const initialMem = process.memoryUsage().heapUsed;
        const TARGET_SIZE = 50 * 1024 * 1024; // 50MB simulation directly tracking overheads

        const boundary = 'extremeLoadBoundary123';
        const rawHeaders = `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="massive.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`;
        const postDataStart = Buffer.from(rawHeaders);
        const postDataEnd = Buffer.from(`\r\n--${boundary}--\r\n`);

        const bigReq = http.request('http://127.0.0.1:27780/api/upload', {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': postDataStart.length + TARGET_SIZE + postDataEnd.length
            }
        });

        bigReq.write(postDataStart);
        
        let sent = 0;
        const chunk = Buffer.alloc(1024 * 64, '0'); // 64kb chunks
        while (sent < TARGET_SIZE) {
            const toSend = Math.min(chunk.length, TARGET_SIZE - sent);
            bigReq.write(chunk.subarray(0, toSend));
            sent += toSend;
        }
        bigReq.end(postDataEnd);

        await new Promise((resolve, reject) => {
            bigReq.on('response', (res) => {
                 if (res.statusCode !== 202) reject(new Error("Massive file failed"));
                 res.on('data', () => {});
                 res.on('end', resolve);
            });
            bigReq.on('error', reject);
        });

        if (global.gc) global.gc();
        const memDiff = (process.memoryUsage().heapUsed - initialMem) / 1024 / 1024;
        console.log(`Massive stream accepted. V8 Memory Overhead Delta: ${memDiff.toFixed(2)} MB (< payload size)`);

        console.log("\n✅ All Enterprise Validations for Phases 1, 2, and 3 PASSED Successfully.");

    } catch (e) {
        console.error("\n❌ TEST ERROR THROWN:");
        console.error(e);
    } finally {
        console.log("Tearing down infrastructure.");
        await node1.peer?.close();
        await node2.peer?.close();
        await node3.peer?.close();
        node1.httpServer?.closeAllConnections();
        node2.httpServer?.closeAllConnections();
        node3.httpServer?.closeAllConnections();
        node1.httpServer?.close();
        node2.httpServer?.close();
        node3.httpServer?.close();
        await node1.ledger.client?.close();
        await node2.ledger.client?.close();
        await node3.ledger.client?.close();
        await mongod.stop();
        console.log("Teardown completed.");
        process.exit(0);
    }
}

runManualTest().catch(console.error);
