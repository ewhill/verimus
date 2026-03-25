import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import type { AddressInfo } from 'node:net';
import PeerNode from '../../peer_node/PeerNode';
import fs from 'node:fs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Bundler from '../../bundler/Bundler';
import LocalFileStorageProvider from '../../storage_providers/local_provider/LocalProvider';
import MemoryStorageProvider from '../../storage_providers/memory_provider/MemoryProvider';
import { BLOCK_TYPES } from '../../constants';

describe('Integration: UI Critical User Journeys (Frontend/Backend System Contract)', () => {
    let node: PeerNode;
    let baseUrl: string;
    let mongod: MongoMemoryServer;

    const mockDataDir = ''; // unused by bundler physically

    before(async () => {
        try {
            mongod = await MongoMemoryServer.create();
            const mongoUri = mongod.getUri();

            // Create an actual node locally interacting natively using an ephemeral port
            node = new PeerNode(0, [], new MemoryStorageProvider() as any, new Bundler(mockDataDir) as any, mongoUri, undefined, {
                ringPublicKeyPath: 'keys/ring.ring.pub',
                publicKeyPath: 'keys/peer_26780.peer.pub',
                privateKeyPath: 'keys/peer_26780.peer.pem',
                signaturePath: 'keys/peer_26780.peer.signature'
            }, mockDataDir);

            await node.init();
            
            // Override mocked components AFTER initialization to ensure tests don't leak external discovery attempts
            if (node.peer) {
                node.peer.broadcast = async () => [];
                (node.peer as any).request = async () => ({});
            }
            node.consensusEngine.walletManager.verifyFunds = async () => true;
            node.consensusEngine.node.syncEngine.orchestrateStorageMarket = async () => {
                return [{ peerId: 'mock-host-1', connection: {} }];
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
        // Halt physical servers explicitly shutting down network sockets allowing Node to exit
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

        // Hermetic cleanup natively mapped
        if (mongod) {
            await mongod.stop();
        }
    });

    it('Bootstraps network config', async () => {
        try {
            const response = await fetch(`${baseUrl}/api/node/config`);
            assert.strictEqual(response.status, 200, 'Express successfully handled the config request');
            const data: any = await response.json();

            assert.ok(data.port !== undefined, 'UI configuration surface exposed natively');
            assert.ok(data.publicKey, 'Generated RSA definitions mapped');
        } catch(e: any) {
            console.error('Config Error:', e);
            throw e;
        }
    });

    it('Uploads payload mimicking File Form submission', async () => {
        try {
            const formDataPayload = new FormData();
            const testFileBlob = new Blob(['Integration test payload data mapping natively'], { type: 'text/plain' });
            formDataPayload.append('files', testFileBlob, 'integration.txt');

            const response = await fetch(`${baseUrl}/api/upload?trustedPeers=`, {
                method: 'POST',
                body: formDataPayload as any // TS casting for standard native FormData mechanics
            });

            assert.strictEqual(response.status, 202, 'Upload resolved smoothly saving file natively');
            const data: any = await response.json();
            
            assert.strictEqual(data.success, true, 'Block formally committed mapping physical blocks natively');
            assert.ok(data.hash, 'Uploaded block hash structured appropriately natively');
            assert.ok(data.aesKey, 'Encryption definitions returned safely dynamically natively');
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
                assert.strictEqual(response.status, 200, 'Ledger endpoint parsed synchronously appropriately');
                ledger = await response.json();
                if (ledger.blocks && ledger.blocks.length >= 1) break;
                await new Promise(r => setTimeout(r, 100));
            }
            assert.ok(ledger.blocks.length >= 1, 'Genesis block logically instantiated actively natively');
        } catch(e: any) {
            console.error('Ledger Error:', e);
            throw e;
        }
    });

    it('Fetches network file trees', async () => {
        const response = await fetch(`${baseUrl}/api/files`);
        assert.strictEqual(response.status, 200, 'Files view instantiated neatly dynamically natively');

        const parsed: any = await response.json();
        assert.strictEqual(parsed.success, true, 'Files array executed natively sequentially logically');

        // We uploaded integration.txt previously via the simulated journey correctly
        const fileEntry = parsed.files.find((f: any) => f.path === 'integration.txt');
        assert.ok(fileEntry, 'Aggregated parsed trees reflect logical filesystem natively structurally');
        assert.strictEqual(fileEntry.versions.length, 1, 'Versions grouped mapping historical hashes efficiently');
    });

    it('Requests block structures for Peers View', async () => {
        try {
            const response = await fetch(`${baseUrl}/api/peers`);
            assert.strictEqual(response.status, 200, 'Peers payload dispatched structurally cleanly intelligently');

            const peersData: any = await response.json();
            assert.ok(Array.isArray(peersData.peers), 'Peers payload formally evaluates physical boundaries structurally natively');
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
                targetBlock = blockRes.blocks.find((b: any) => b.metadata && b.metadata.index > 0 && b.type === BLOCK_TYPES.STORAGE_CONTRACT);
                if (targetBlock) break;
                await new Promise(r => setTimeout(r, 200));
            }
            assert.ok(targetBlock, 'Previously committed block accessible locally naturally');

            const decryptRes = await fetch(`${baseUrl}/api/blocks/${targetBlock.hash}/private?privateKey=${encodeURIComponent(node.privateKey)}`);
            assert.strictEqual(decryptRes.status, 200, 'Private payload decryption mapping completed seamlessly comprehensively');
            
            const decryptedPayload: any = await decryptRes.json();
            assert.strictEqual(decryptedPayload.payload.files[0].path, 'integration.txt', 'Raw structures resolved cleanly mapped locally natively');
        } catch (e: any) {
            console.error('Decrypt Error:', e);
            throw e;
        }
    });

    it('Retrieves files tracking pipeline decryptors', async () => {
        try {
            let blockRes: any = { blocks: [] };
            let targetBlock;
            // Wait for consensus commit logic (index > 0) moving block out of mempool onto storage native collection
            for (let i = 0; i < 20; i++) {
                blockRes = await (await fetch(`${baseUrl}/api/blocks`)).json();
                targetBlock = blockRes.blocks.find((b: any) => b.metadata && b.metadata.index > 0 && b.type === BLOCK_TYPES.STORAGE_CONTRACT);
                if (targetBlock) break;
                await new Promise(r => setTimeout(r, 200));
            }
            assert.ok(targetBlock, 'Previously committed block natively tracked and physically structured');

            const downloadRes = await fetch(`${baseUrl}/api/download/${targetBlock.hash}/file/integration.txt?privateKey=${encodeURIComponent(node.privateKey)}`);

            if (downloadRes.status !== 200) {
                const text = await downloadRes.text();
                console.error('Download 404 text:', text);
            }
            assert.strictEqual(downloadRes.status, 200, 'Download payload streaming dynamically handled gracefully');
            const buffer = await downloadRes.text();
            
            assert.strictEqual(buffer, 'Integration test payload data mapping natively', 'AES stream natively mapped perfectly recovering original payload dynamically seamlessly natively');
        } catch (e: any) {
            console.error('Download Error:', e);
            throw e;
        }
    });
});
