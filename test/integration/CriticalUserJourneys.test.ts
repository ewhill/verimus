import assert from 'node:assert';
import type { AddressInfo } from 'node:net';
import { describe, it, before, after } from 'node:test';

import { MongoMemoryServer } from 'mongodb-memory-server';

import Bundler from '../../bundler/Bundler';
import { BLOCK_TYPES } from '../../constants';
import * as cryptoUtils from '../../crypto_utils/CryptoUtils';
import PeerNode from '../../peer_node/PeerNode';
import MemoryStorageProvider from '../../storage_providers/memory_provider/MemoryProvider';

describe('Integration: UI Critical User Journeys (Frontend/Backend System Contract)', () => {
    let node: PeerNode;
    let baseUrl: string;
    let mongod: MongoMemoryServer;

    const mockDataDir = ''; // unused by bundler

    before(async () => {
        try {
            mongod = await MongoMemoryServer.create();
            const mongoUri = mongod.getUri();

            // Create an actual node locally interacting using an ephemeral port
            node = new PeerNode(0, [], new MemoryStorageProvider(), new Bundler(mockDataDir), mongoUri, undefined, {
                ringPublicKeyPath: 'keys/ring.ring.pub',
                publicKeyPath: 'keys/peer_26780.peer.pub',
                privateKeyPath: 'keys/peer_26780.peer.pem',
                signaturePath: 'keys/peer_26780.peer.signature'
            }, mockDataDir);

            await node.init();

            // Create a local map tracking the physical Shard limits for valid mathematical verification 
            const globalIntegrationShards: { [marketReqId: string]: Buffer } = {};

            if (node.peer) {
                node.peer.broadcast = async (msg: any) => {
                    if (msg.name === 'VerifyHandoffRequestMessage') {
                        setTimeout(async () => {
                            node.events.emit(`handoff_response:${msg.body.marketId}:${msg.body.physicalId}`, {
                                success: true,
                                merkleSiblings: ['dummy_boundary'],
                                chunkDataBase64: Buffer.from('IntegrationBounds').toString('base64')
                            });
                        }, 5);
                    }
                };
                Object.defineProperty(node.peer, 'trustedPeers', { get: () => ['mock'] });
                Object.assign(node.peer, { request: async () => ({}) });
            }
            node.consensusEngine.walletManager.verifyFunds = async () => true;
            node.consensusEngine.runGlobalAudit = async () => { };
            node.consensusEngine.node.syncEngine.orchestrateStorageMarket = async (marketReqId: string) => {
                return [{
                    peerId: node.publicKey, connection: {
                        send: (msg: any) => {
                            if (msg.constructor && msg.constructor.name === 'VerifyHandoffRequestMessage') {
                                setTimeout(() => {
                                    const fullShardBuffer = globalIntegrationShards[msg.body.physicalId];
                                    const CHUNK_SIZE = 64 * 1024;
                                    const chunks: Buffer[] = [];
                                    for (let offset = 0; offset < fullShardBuffer.length; offset += CHUNK_SIZE) {
                                        chunks.push(fullShardBuffer.subarray(offset, offset + CHUNK_SIZE));
                                    }

                                    const { tree } = cryptoUtils.buildMerkleTree(chunks);
                                    const siblingPath = cryptoUtils.getMerkleProof(tree, msg.body.targetChunkIndex);

                                    node.events.emit(`handoff_response:${marketReqId}:${msg.body.physicalId}`, {
                                        success: true,
                                        merkleSiblings: siblingPath,
                                        chunkDataBase64: chunks[msg.body.targetChunkIndex].toString('base64')
                                    });
                                }, 5);
                                return;
                            }

                            // Physically store mocking the remote node reception natively mapping bounds
                            const buf = Buffer.from(msg.body.shardDataBase64, 'base64');
                            const blockResult = node.storageProvider!.createBlockStream();
                            globalIntegrationShards[blockResult.physicalBlockId] = buf;
                            blockResult.writeStream.write(buf);
                            blockResult.writeStream.end();

                            setTimeout(() => {
                                node.events.emit(`shard_response:${marketReqId}:${msg.body.shardIndex}`, { success: true, physicalId: blockResult.physicalBlockId });
                            }, 5);
                        }
                    }
                }];
            };

            const server = node.httpServer!;
            const address = server.address() as AddressInfo;
            baseUrl = `https://127.0.0.1:${address.port}`;
        } catch (e: any) {
            console.error('Critical Error in BEFORE Hook:', e.stack);
            throw e;
        }
    });

    after(async () => {
        // Halt physical servers shutting down network sockets allowing Node to exit
        if (node) {
            if (node.httpServer) {
                node.httpServer.close();
                node.httpServer.closeAllConnections();
            }
            if (node.syncEngine && node.syncEngine.syncInterval) {
                clearInterval(node.syncEngine.syncInterval);
            }
            if (node.peer) {
                await node.peer.close();
            }
            if (node.ledger && node.ledger.client) {
                await node.ledger.client.close();
            }
        }

        // Hermetic cleanup mapped
        if (mongod) {
            await mongod.stop();
        }
    });

    it('Bootstraps network config', async () => {
        try {
            const response = await fetch(`${baseUrl}/api/node/config`);
            assert.strictEqual(response.status, 200, 'Express successfully handled the config request');
            const data: any = await response.json();

            assert.ok(data.port !== undefined, 'UI configuration surface exposed');
            assert.ok(data.publicKey, 'Generated RSA definitions mapped');
        } catch (e: any) {
            console.error('Config Error:', e);
            throw e;
        }
    });

    it('Uploads payload mimicking File Form submission', async () => {
        try {
            const formDataPayload = new FormData();
            const testFileBlob = new Blob(['Integration test payload data mapping'], { type: 'text/plain' });
            formDataPayload.append('files', testFileBlob, 'integration.txt');

            const response = await fetch(`${baseUrl}/api/upload?trustedPeers=`, {
                method: 'POST',
                body: formDataPayload
            });

            assert.strictEqual(response.status, 202, 'Upload resolved saving file');
            const data: any = await response.json();

            assert.strictEqual(data.success, true, 'Block formally committed mapping physical blocks');
            assert.ok(data.hash, 'Uploaded block hash structured');
            assert.ok(data.aesKey, 'Encryption definitions returned');
        } catch (e: any) {
            console.error('Upload Error:', e);
            throw e;
        }
    });

    it('Fetches network ledgers populating Ledger View', async () => {
        try {
            let ledger: any = { blocks: [] };
            for (let i = 0; i < 20; i++) {
                const response = await fetch(`${baseUrl}/api/blocks`);
                assert.strictEqual(response.status, 200, 'Ledger endpoint parsed synchronously');
                ledger = await response.json();
                if (ledger.blocks && ledger.blocks.length >= 1) break;
                await new Promise(r => setTimeout(r, 100));
            }
            assert.ok(ledger.blocks.length >= 1, 'Genesis block instantiated');
        } catch (e: any) {
            console.error('Ledger Error:', e);
            throw e;
        }
    });

    it('Fetches network file trees', async () => {
        const response = await fetch(`${baseUrl}/api/files`);
        assert.strictEqual(response.status, 200, 'Files view instantiated neatly');

        const parsed: any = await response.json();
        assert.strictEqual(parsed.success, true, 'Files array executed sequentially');

        // We uploaded integration.txt previously via the simulated journey correctly
        const fileEntry = parsed.files.find((f: any) => f.path === 'integration.txt');
        assert.ok(fileEntry, 'Aggregated parsed trees reflect logical filesystem');
        assert.strictEqual(fileEntry.versions.length, 1, 'Versions grouped mapping historical hashes');
    });

    it('Requests block structures for Peers View', async () => {
        try {
            const response = await fetch(`${baseUrl}/api/peers`);
            assert.strictEqual(response.status, 200, 'Peers payload dispatched');

            const peersData: any = await response.json();
            assert.ok(Array.isArray(peersData.peers), 'Peers payload formally evaluates physical boundaries');
        } catch (e: any) {
            console.error('Peers Error:', e);
            throw e;
        }
    });

    it('Decrypts raw block payloads', async () => {
        try {
            let blockRes: any = { blocks: [] };
            let targetBlock;
            for (let i = 0; i < 20; i++) {
                blockRes = await (await fetch(`${baseUrl}/api/blocks`)).json();
                targetBlock = blockRes.blocks.find((b: any) => b.metadata && b.metadata.index > 1 && b.type === BLOCK_TYPES.STORAGE_CONTRACT);
                if (targetBlock) break;
                await new Promise(r => setTimeout(r, 200));
            }
            assert.ok(targetBlock, 'Previously committed block accessible locally');

            const decryptRes = await fetch(`${baseUrl}/api/blocks/${targetBlock.hash}/private?privateKey=${encodeURIComponent(node.privateKey)}`);
            assert.strictEqual(decryptRes.status, 200, 'Private payload decryption mapping completed');

            const decryptedPayload: any = await decryptRes.json();
            assert.strictEqual(decryptedPayload.payload.files[0].path, 'integration.txt', 'Raw structures resolved mapped locally');
        } catch (e: any) {
            console.error('Decrypt Error:', e);
            throw e;
        }
    });

    it('Retrieves files via pipeline decryptors', async () => {
        try {
            let blockRes: any = { blocks: [] };
            let targetBlock;
            // Wait for consensus commit logic (index > 0) moving block out of mempool onto storage native collection
            for (let i = 0; i < 20; i++) {
                blockRes = await (await fetch(`${baseUrl}/api/blocks`)).json();
                targetBlock = blockRes.blocks.find((b: any) => b.metadata && b.metadata.index > 1 && b.type === BLOCK_TYPES.STORAGE_CONTRACT);
                if (targetBlock) break;
                await new Promise(r => setTimeout(r, 200));
            }
            assert.ok(targetBlock, 'Previously committed block tracked and structured');

            const downloadRes = await fetch(`${baseUrl}/api/download/${targetBlock.hash}/file/integration.txt?privateKey=${encodeURIComponent(node.privateKey)}`);

            if (downloadRes.status !== 200) {
                const text = await downloadRes.text();
                console.error('Download 404 text:', text);
            }
            assert.strictEqual(downloadRes.status, 200, 'Download payload streaming handled');
            const buffer = await downloadRes.text();

            assert.strictEqual(buffer, 'Integration test payload data mapping', 'AES stream mapped recovering original payload');
        } catch (e: any) {
            console.error('Download Error:', e);
            throw e;
        }
    });
});
