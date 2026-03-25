import fs from 'fs';
import http from 'http';
import https from 'https';
import assert from 'node:assert';
import { describe, it, before, after } from 'node:test';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import stream from 'stream';

import { MongoMemoryServer } from 'mongodb-memory-server';

import Bundler from '../../bundler/Bundler';
import PeerNode from '../../peer_node/PeerNode';
import BaseProvider, { GetBlockReadStreamResult } from '../../storage_providers/base_provider/BaseProvider';

class NullStorageProvider extends BaseProvider {
    createBlockStream(): { physicalBlockId: string, writeStream: NodeJS.WritableStream } {
        const physicalBlockId = 'null-fs-' + Date.now();
        const writeStream = new stream.Writable({
            write(chunk, encoding, callback) {
                callback();
            }
        });
        return { physicalBlockId, writeStream };
    }

    async getBlock(locationId: string): Promise<Buffer | null> {
        return null;
    }
    
    async getBlockReadStream(locationId: string): Promise<GetBlockReadStreamResult> {
        return { status: 'available', stream: Object.create(stream.Readable.prototype) };
    }
    
    getCostPerGB(): number { return 0.0; }
    getEgressCostPerGB(): number { return 0.0; }

    getLocation(): { type: string } {
        return { type: 'null://local' };
    }
}

describe('Integration: Enterprise Stress Testing Core Pipelines (Phase 3)', () => {
    let mongod: MongoMemoryServer;
    let node: PeerNode;
    let baselineMemory: number;

    before(async () => {
        mongod = await MongoMemoryServer.create();
        
        const tmpLoad = fs.mkdtempSync(path.join(os.tmpdir(), 'verimus-'));
        node = new PeerNode(32000, [], new NullStorageProvider(), new Bundler(tmpLoad), mongod.getUri(), undefined, {
            ringPublicKeyPath: 'keys/ring.ring.pub',
            publicKeyPath: 'keys/peer_26780.peer.pub',
            privateKeyPath: 'keys/peer_26780.peer.pem',
            signaturePath: 'keys/peer_26780.peer.signature'
        }, tmpLoad);

        node.publicKey = fs.readFileSync('keys/peer_26780.peer.pub', 'utf8');
        node.privateKey = fs.readFileSync('keys/peer_26780.peer.pem', 'utf8');
        node.signature = fs.readFileSync('keys/peer_26780.peer.signature', 'utf8');

        const mockPeer = {
             trustedPeers: [],
             broadcast: async () => {},
             bind: () => ({ to: () => {} }),
             close: async () => {}
        };
        (node as any).peer = mockPeer;
        node.consensusEngine.handlePendingBlock = async () => {};

        await node.ledger.init(32000);
        await node.loadOwnedBlocksCache();

        // Pass integration escrows mapping stream limits bypassing real topologies
        node.consensusEngine.walletManager.verifyFunds = async () => true;
        node.consensusEngine.node.syncEngine.orchestrateStorageMarket = async () => {
            return [{ peerId: 'mock-1', connection: {} }];
        };

        const setupExpressApp = (await import('../../api_server/ApiServer')).default;
        const app = setupExpressApp(node);
        node.httpServer = http.createServer(app) as any;
        await new Promise<void>(resolve => node.httpServer!.listen(32000, '0.0.0.0', () => resolve()));
    });

    after(async () => {
        node.httpServer?.close();
        node.httpServer?.closeAllConnections();
        await node.ledger.client?.close();
        await mongod.stop();
    });

    it('Processes large scale injections with low memory footprint', async () => {
        // Run garbage collection if available
        if (global.gc) global.gc();
        baselineMemory = process.memoryUsage().heapUsed;

        // Generate a synthetic stream of sizes. Let's do 200MB to be fast and not crash CI, but large enough to prove OOM won't occur
        const TARGET_SIZE = 200 * 1024 * 1024; // 200 Megabytes
        const CHUNK_SIZE = 64 * 1024;
        let generatedBytes = 0;

        const bigStream = new Readable({
             read(size) {
                 if (generatedBytes >= TARGET_SIZE) {
                     this.push(null);
                 } else {
                     const toPush = Math.min(CHUNK_SIZE, TARGET_SIZE - generatedBytes);
                     this.push(Buffer.alloc(toPush, 'a'));
                     generatedBytes += toPush;
                 }
             }
        });

        // We build a manual multipart-form POST for the extreme stream mapping
        const boundary = '--------------------------extremeBoundary123';
        const postDataStart = Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="files"; filename="massive_payload.bin"\r\n` +
            `Content-Type: application/octet-stream\r\n\r\n`
        );
        const postDataEnd = Buffer.from(`\r\n--${boundary}--\r\n`);

        const req = http.request('http://127.0.0.1:32000/api/upload', {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': postDataStart.length + TARGET_SIZE + postDataEnd.length
            }
        });

        req.write(postDataStart);

        await new Promise((resolve, reject) => {
             bigStream.pipe(req, { end: false });
             bigStream.on('end', () => {
                 req.end(postDataEnd);
             });
             req.on('response', (res) => {
                 if (res.statusCode !== 202 && res.statusCode !== 200) {
                      reject(new Error(`Server failed upload with status: ${res.statusCode}`));
                 }
                 res.on('data', () => {}); // Consumer 
                 res.on('end', () => resolve(true));
             });
             req.on('error', reject);
        });

        if (global.gc) global.gc();
        const postUploadMemory = process.memoryUsage().heapUsed;
        const memoryDiffMB = (postUploadMemory - baselineMemory) / 1024 / 1024;
        
        // As it streams directly via chunks, the memory usage overhead footprint should remain significantly lower than the payload size!
        assert.ok(memoryDiffMB < 50, `V8 memory buffer overhead escalated destructively beyond stream pipeline ceilings! Memory grew by ${memoryDiffMB.toFixed(2)} MB`);
    });
});
