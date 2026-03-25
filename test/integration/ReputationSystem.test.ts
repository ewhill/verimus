import crypto from 'crypto';
import fs from 'fs';
import assert from 'node:assert';
import { describe, it, before, after } from 'node:test';
import * as url from 'node:url';
import os from 'os';
import path from 'path';

import { MongoMemoryServer } from 'mongodb-memory-server';

import Bundler from '../../bundler/Bundler';
import { hashData } from '../../crypto_utils/CryptoUtils';
import { ChainStatusRequestMessage } from '../../messages/chain_status_request_message/ChainStatusRequestMessage';
import { PendingBlockMessage } from '../../messages/pending_block_message/PendingBlockMessage';
import RSAKeyPair from '../../p2p/lib/rsakeypair';
import PeerNode from '../../peer_node/PeerNode';
import MemoryStorageProvider from '../../storage_providers/memory_provider/MemoryProvider';


process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

describe('Integration: Reputation System (5 Nodes)', () => {
    let mongod: MongoMemoryServer;
    let nodes: PeerNode[] = [];
    let tempDir: string;

    before(async () => {
        mongod = await MongoMemoryServer.create();
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rep-test-'));


        const ringKeys = RSAKeyPair.generate();
        fs.writeFileSync(path.join(tempDir, 'ring.pub'), ringKeys.public);

        // Spin up 5 Nodes
        for (let i = 0; i < 5; i++) {
            const keys = RSAKeyPair.generate();
            const signature = ringKeys.sign(keys.public).toString('hex');

            fs.writeFileSync(path.join(tempDir, `node${i}.pub`), keys.public);
            fs.writeFileSync(path.join(tempDir, `node${i}.pem`), keys.private);
            fs.writeFileSync(path.join(tempDir, `node${i}.sig`), signature);

            const dbUri = mongod.getUri(`node${i}`);

            // Nodes sequentially connect to Node 1 (using ephemeral 0 originally)
            const trusted: string[] = []; // let discover bypass initially
            const keyPaths = {
                publicKeyPath: path.join(tempDir, `node${i}.pub`),
                privateKeyPath: path.join(tempDir, `node${i}.pem`),
                signaturePath: path.join(tempDir, `node${i}.sig`),
                ringPublicKeyPath: path.join(tempDir, `ring.pub`)
            };

            const node = new PeerNode(0, trusted, new MemoryStorageProvider() as any, new Bundler(tempDir) as any, dbUri, undefined, keyPaths, tempDir);

            // Mock discover locally to prevent long polling hangs inside init() loop
            if (node.peer) {
                node.peer.discover = async () => { };
            }

            await node.init();

            // Assign ephemeral port manually
            node.port = (node.httpServer!.address() as any).port;
            (node.peer as any).publicAddress_ = `127.0.0.1:${node.port}`;

            nodes.push(node);
        }

        // Manually connect now that servers are all bound

        for (let i = 1; i < 5; i++) {
            const addr = `wss://127.0.0.1:${nodes[0].port}`;
            await (nodes[i].peer as any)?.attemptConnection({ originalAddress: addr, parsedAddress: url.parse(addr) });
        }

        // Wait for discovery and WebSocket handshake resolutions
        await new Promise(r => setTimeout(r, 2000));
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

    it('Nodes establish P2P WebSocket connections', async () => {
        const rootPeerCount = nodes[0].peer?.peers?.length || 0;
        assert.ok(rootPeerCount >= 4, 'Root node directly tracks 4 explicit peers');

        const childPeerCount = nodes[4].peer?.peers?.length || 0;
        assert.ok(childPeerCount >= 1, 'Child node connects');
    });

    it('Enforces structural penalty (-10) for corrupted hashes', async () => {
        const node1 = nodes[0];
        const node2 = nodes[1];

        const fakeBlock = {
            metadata: { index: 99, timestamp: Date.now() },
            hash: 'wrong_hash',
            previousHash: 'fake',
            publicKey: node2.publicKey,
            payload: { fake: true },
            signature: 'fakesig'
        };

        const connToNode1 = node2.peer?.peers[0];


console.log('SENDING FAKE BLOCK!');
console.log(connToNode1?.send ? 'METHOD EXISTS' : 'UNDEFINED METHOD');
        connToNode1?.send(new PendingBlockMessage({ block: fakeBlock as any }));

        await new Promise(r => setTimeout(r, 500));

        const node2ScoreRecord = await node1.ledger.peersCollection?.findOne({ publicKey: node2.publicKey });
        assert.ok(node2ScoreRecord, 'Node 1 created active reputation record');
        assert.strictEqual(node2ScoreRecord?.score, 90, 'Node 1 correctly docked Node 2 (-10)');
    });

    it('Enforces critical penalty (-100) and bans node', async () => {
        const node1 = nodes[0];
        const node3 = nodes[2];


        const block = {
            metadata: { index: 99, timestamp: Date.now() },
            previousHash: 'fake',
            publicKey: node3.publicKey,
            payload: { fake: true },
            signature: 'invalid_sig'
        };
        const str = JSON.stringify(block);
        (block as any).hash = hashData(str);

        const connToNode1 = node3.peer?.peers[0];


console.log('SENDING INVALID SIG BLOCK!');
        connToNode1?.send(new PendingBlockMessage({ block: block as any }));

        await new Promise(r => setTimeout(r, 500));

        const node3ScoreRecord = await node1.ledger.peersCollection?.findOne({ publicKey: node3.publicKey });
        assert.strictEqual(node3ScoreRecord?.score, 0, 'Node 1 docked Node 3 dropping to 0');
        assert.strictEqual(node3ScoreRecord?.isBanned, true, 'Node 1 flagged node');
    });

    it('Drops subsequent connections from banned node', async () => {
        const node1 = nodes[0];
        const node3 = nodes[2];

        // The banned hook in peerNode closes physical sockets
        await new Promise(r => setTimeout(r, 500));

        const connToNode1 = node3.peer?.peers[0];
        assert.ok(!connToNode1 || !connToNode1.isConnected, 'Socket terminated');
    });

    it('Assesses minor penalty (-1) for P2P loop spam', async () => {
        const node1 = nodes[0];
        const node4 = nodes[3];

        const connToNode1 = node4.peer?.peers[0];



        for (let i = 0; i < 5; i++) {
            const msg = new ChainStatusRequestMessage();
            msg.body = { nonce: Math.random() }; // Force unique hash bypassing P2P network LRU drop layer
            connToNode1?.send(msg);
            await new Promise(r => setTimeout(r, 5));
        }

        await new Promise(r => setTimeout(r, 1000));

        const node4ScoreRecord = await node1.ledger.peersCollection?.findOne({ publicKey: node4.publicKey });
        assert.strictEqual(node4ScoreRecord?.score, 99, 'Node 1 penalized node');
    });
});
