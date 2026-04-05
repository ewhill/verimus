import fs from 'fs';
import http from 'http';
import assert from 'node:assert';
import type { AddressInfo } from 'node:net';
import { describe, it, before, after } from 'node:test';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import stream from 'stream';

import { ethers } from 'ethers';
import { MongoMemoryServer } from 'mongodb-memory-server';

import setupExpressApp from '../../api_server/ApiServer';
import Bundler from '../../bundler/Bundler';
import * as cryptoUtils from '../../crypto_utils/CryptoUtils';
import PeerNode from '../../peer_node/PeerNode';
import BaseProvider, { GetBlockReadStreamResult } from '../../storage_providers/base_provider/BaseProvider';

class NullStorageProvider extends BaseProvider {
    createBlockStream(): { physicalBlockId: string, writeStream: NodeJS.WritableStream } {
        const physicalBlockId = 'null-fs-' + Date.now();
        const writeStream = new stream.Writable({
            write(_unusedChunk, _unusedEncoding, callback) {
                callback();
            }
        });
        return { physicalBlockId, writeStream };
    }

    async getBlock(_unusedLocationId: string): Promise<Buffer | null> {
        return null;
    }

    async getBlockReadStream(_unusedLocationId: string): Promise<GetBlockReadStreamResult> {
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

    let tmpLoad: string;

    before(async () => {
        mongod = await MongoMemoryServer.create();

        tmpLoad = fs.mkdtempSync(path.join(os.tmpdir(), 'verimus-'));
        node = new PeerNode(0, [], new NullStorageProvider(), new Bundler(tmpLoad), mongod.getUri(), undefined, {
            ringPublicKeyPath: 'keys/ring.ring.pub',
            publicKeyPath: 'keys/peer_26780.peer.pub',
            privateKeyPath: 'keys/peer_26780.peer.pem',
            signaturePath: 'keys/peer_26780.peer.signature'
        }, tmpLoad);

        node.publicKey = fs.readFileSync('keys/peer_26780.peer.pub', 'utf8');
        node.privateKey = fs.readFileSync('keys/peer_26780.peer.pem', 'utf8');
        node.signature = fs.readFileSync('keys/peer_26780.peer.signature', 'utf8');

        const mockPeer = {
            trustedPeers: [{ id: 'mock-test' }],
            broadcast: async (msg: any) => {
                if (msg.name === 'VerifyHandoffRequestMessage') {
                    setTimeout(() => {
                        node.events.emit(`handoff_response:${msg.body.marketId}:${msg.body.physicalId}`, {
                            success: true,
                            merkleSiblings: ['dummy_boundary'],
                            chunkDataBase64: Buffer.from('IntegrationBounds').toString('base64')
                        });
                    }, 5);
                }
            },
            bind: () => ({ to: () => { } }),
            close: async () => { }
        };
        Object.assign(node, { peer: mockPeer });
        node.wallet = ethers.Wallet.createRandom();
        node.walletAddress = node.wallet.address;


        node.consensusEngine.handlePendingBlock = async () => { };

        await node.ledger.init(0);
        await node.loadOwnedBlocksCache();

        // Pass integration escrows mapping stream limits bypassing real topologies
        node.consensusEngine.walletManager.verifyFunds = async () => true;
        const storedShards = new Map<string, { tree: string[][], chunks: Buffer[] }>();

        node.consensusEngine.node.syncEngine.orchestrateStorageMarket = async (marketReqId: string) => {
            return [{
                peerId: node.publicKey, connection: {
                    send: (msg: any) => {
                        if (!msg.body.shardDataBase64) {
                            const physicalId = msg.body.physicalId;
                            const targetIdx = msg.body.targetChunkIndex;
                            const shardData = storedShards.get(physicalId)!;
                            const siblings = cryptoUtils.getMerkleProof(shardData.tree, targetIdx);
                            const chunkBase64 = shardData.chunks[targetIdx].toString('base64');

                            setTimeout(() => {
                                node.events.emit(`handoff_response:${msg.body.marketId}:${msg.body.physicalId}`, {
                                    success: true,
                                    merkleSiblings: siblings,
                                    chunkDataBase64: chunkBase64
                                });
                            }, 5);
                            return;
                        }

                        const buf = Buffer.from(msg.body.shardDataBase64, 'base64');
                        
                        const CHUNK_SIZE = 64 * 1024;
                        const chunks: Buffer[] = [];
                        for (let i = 0; i < buf.length; i += CHUNK_SIZE) {
                            chunks.push(buf.subarray(i, i + CHUNK_SIZE));
                        }
                        const { tree } = cryptoUtils.buildMerkleTree(chunks);

                        const blockResult = node.storageProvider!.createBlockStream();
                        blockResult.writeStream.write(buf);
                        blockResult.writeStream.end();

                        storedShards.set(blockResult.physicalBlockId, { tree, chunks });

                        setTimeout(() => {
                            node.events.emit(`shard_response:${marketReqId}:${msg.body.shardIndex}`, { success: true, physicalId: blockResult.physicalBlockId });
                        }, 5);
                    }
                }
            }];
        };

        const app = setupExpressApp(node);
        Object.assign(node, { httpServer: http.createServer(app) });
        await new Promise<void>(resolve => node.httpServer!.listen(0, '0.0.0.0', () => {
            node.port = (node.httpServer!.address() as AddressInfo).port;
            resolve();
        }));
    });

    after(async () => {
        node.httpServer?.close();
        node.httpServer?.closeAllConnections();
        await node.ledger.client?.close();
        await mongod.stop();
        if (tmpLoad) {
            fs.rmSync(tmpLoad, { recursive: true, force: true });
        }
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
            read(_unusedSize) {
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

        const wallet = ethers.Wallet.createRandom();
        const timestamp = Date.now().toString();
        const authTagStr = 'batch';
        const proxyMessage = `Approve Verimus Originator proxy for data struct ${authTagStr}\nTimestamp: ${timestamp}`;
        const signature = await wallet.signMessage(proxyMessage);
        
        const extraFields = 
            `--${boundary}\r\nContent-Disposition: form-data; name="ownerAddress"\r\n\r\n${wallet.address}\r\n` +
            `--${boundary}\r\nContent-Disposition: form-data; name="ownerSignature"\r\n\r\n${signature}\r\n` +
            `--${boundary}\r\nContent-Disposition: form-data; name="timestamp"\r\n\r\n${timestamp}\r\n` +
            `--${boundary}\r\nContent-Disposition: form-data; name="encryptedAesKey"\r\n\r\nmockHex\r\n` +
            `--${boundary}\r\nContent-Disposition: form-data; name="authTag"\r\n\r\n${authTagStr}\r\n`;

        const postDataStart = Buffer.from(extraFields + 
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="files"; filename="massive_payload.bin"\r\n` +
            `Content-Type: application/octet-stream\r\n\r\n`
        );
        const postDataEnd = Buffer.from(`\r\n--${boundary}--\r\n`);

        const req = http.request(`http://127.0.0.1:${node.port}/api/upload`, {
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
                let responseData = '';
                res.on('data', (chunk) => { responseData += chunk; }); // Consumer 
                res.on('end', () => {
                    if (res.statusCode !== 202 && res.statusCode !== 200) {
                        reject(new Error(`Server failed upload with status: ${res.statusCode} Body: ${responseData}`));
                    } else {
                        resolve(true);
                    }
                });
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
