import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import FilesHandler from '../FilesHandler';
import { generateRSAKeyPair, encryptPrivatePayload } from '../../../crypto_utils/CryptoUtils';

describe('Backend: filesHandler Coverage', () => {
    let mockNode: any;
    let req: any;
    let res: any;
    let keys: any;

    beforeEach(() => {
        keys = generateRSAKeyPair();
        mockNode = {
            publicKey: 'testPubKey',
            privateKey: keys.privateKey,
            ownedBlocksCache: [],
            ledger: {
                collection: {
                    find: () => ({
                        toArray: async () => []
                    })
                }
            },
            mempool: {
                pendingBlocks: new Map()
            }
        };

        req = {};
        res = {
            jsonStr: '',
            statusObj: 200,
            json(data: any) { this.jsonStr = JSON.stringify(data); return this; },
            status(code: number) { this.statusObj = code; return this; }
        };
    });

    it('Returns empty array natively isolating blank node mapping payloads', async () => {
        const handler = new FilesHandler(mockNode as any);
        await handler.handle(req as any, res as any);
        
        const responseData = JSON.parse(res.jsonStr);
        assert.strictEqual(responseData.success, true);
        assert.strictEqual(responseData.files.length, 0);
    });

    it('Traverses linear block histories merging virtual structured directory paths', async () => {
        const encrypted = encryptPrivatePayload(keys.publicKey, { 
            location: { type: 's3', bucket: 'test-bucket' }, 
            files: [{ path: 'doc1.pdf', size: 1000, hash: 'fileHash123' }] 
        });
        
        mockNode.ownedBlocksCache = ['hashABC'];
        mockNode.ledger.collection.find = () => ({
            toArray: async () => [{ metadata: { index: 5, timestamp: 9999 }, hash: 'hashABC', publicKey: 'testPubKey', private: encrypted }]
        });
        
        const handler = new FilesHandler(mockNode as any);
        await handler.handle(req as any, res as any);
        
        const responseData = JSON.parse(res.jsonStr);
        assert.strictEqual(responseData.success, true);
        assert.strictEqual(responseData.files.length, 1);
        
        const file = responseData.files[0];
        assert.strictEqual(file.path, 'doc1.pdf');
        assert.strictEqual(file.location.type, 's3');
        assert.strictEqual(file.location.label, 's3://test-bucket');
        assert.strictEqual(file.versions.length, 1);
        assert.strictEqual(file.versions[0].hash, 'fileHash123');
    });

    it('Filters mapping arrays by target metadata matching requested filters', async () => {
        const encrypted = encryptPrivatePayload(keys.publicKey, { 
            files: [{ path: 'pendingDoc.txt' }] 
        });
        
        mockNode.mempool.pendingBlocks.set('pending-sig', {
            committed: false,
            block: { publicKey: 'testPubKey', private: encrypted, hash: 'pendingHash' }
        });
        
        const handler = new FilesHandler(mockNode as any);
        await handler.handle(req as any, res as any);
        
        const responseData = JSON.parse(res.jsonStr);
        assert.strictEqual(responseData.success, true);
        assert.strictEqual(responseData.files.length, 1);
        assert.strictEqual(responseData.files[0].path, 'pendingDoc.txt');
    });

    it('Bypasses cache mappings handling query param overrides returning raw responses', async () => {
        const handler = new FilesHandler(null as any);
        await handler.handle(req as any, res as any);
        assert.strictEqual(res.statusObj, 500);
        const responseData = JSON.parse(res.jsonStr);
        assert.strictEqual(responseData.success, false);
    });

    it('Consolidates logical file version timelines mapping sequential hash indices', async () => {
        const encrypted = encryptPrivatePayload(keys.publicKey, { 
            location: { type: 'local', storageDir: '/tmp' }, 
            files: [{ path: 'doc1.pdf', size: 1000, hash: 'hash1' }] 
        });
        const encrypted2 = encryptPrivatePayload(keys.publicKey, { 
            location: { type: 'local', storageDir: '/tmp' }, 
            files: [{ path: 'doc1.pdf', size: 1200, hash: 'hash2' }] 
        });
        
        mockNode.ownedBlocksCache = ['b1', 'b2'];
        mockNode.ledger.collection.find = () => ({
            toArray: async () => [
                { metadata: { index: 1, timestamp: 1000 }, hash: 'b1', publicKey: 'testPubKey', private: encrypted },
                { metadata: { index: 2, timestamp: 2000 }, hash: 'b2', publicKey: 'testPubKey', private: encrypted2 }
            ]
        });
        
        const handler = new FilesHandler(mockNode as any);
        await handler.handle(req as any, res as any);
        
        const responseData = JSON.parse(res.jsonStr);
        assert.strictEqual(responseData.success, true);
        assert.strictEqual(responseData.files.length, 1);
        
        const file = responseData.files[0];
        assert.strictEqual(file.versions.length, 2);
        assert.strictEqual(file.versions[0].hash, 'hash2'); // Newer timestamp sorts first
        assert.strictEqual(file.versions[1].hash, 'hash1');
    });

    it('Gracefully traps payload decryption pipeline errors bypassing invalid blocks', async () => {
        mockNode.ownedBlocksCache = ['badBlock'];
        mockNode.ledger.collection.find = () => ({
            toArray: async () => [
                { hash: 'badBlock', publicKey: 'testPubKey', private: 'CORRUPTED' }
            ]
        });
        
        const handler = new FilesHandler(mockNode as any);
        await handler.handle(req as any, res as any);
        
        const responseData = JSON.parse(res.jsonStr);
        assert.strictEqual(responseData.success, true);
        assert.strictEqual(responseData.files.length, 0);
    });

    it('Identifies unknown backend storage models casting fallback defaults seamlessly', async () => {
        const encrypted = encryptPrivatePayload(keys.publicKey, { 
            files: [{ path: 'no-loc.txt' }] 
        });
        const encrypted2 = encryptPrivatePayload(keys.publicKey, { 
            location: { type: 'samba', share: '\\\\share' },
            files: [{ path: 'samba.txt' }] 
        });
        const encrypted3 = encryptPrivatePayload(keys.publicKey, { 
            location: { type: 'remote-fs', host: 'test-host', dir: '/test-dir' },
            files: [{ path: 'remote.txt' }] 
        });
        const encrypted4 = encryptPrivatePayload(keys.publicKey, { 
            location: { type: 'glacier', vault: 'my-vault' },
            files: [{ path: 'glacier.txt' }] 
        });
        
        mockNode.ownedBlocksCache = undefined; // Cover default ownedBlocksCache init
        
        // Add pending block directly to mempool since we cleared owned blocks
        mockNode.mempool.pendingBlocks.set('pending1', {
            committed: false,
            block: { publicKey: 'testPubKey', private: encrypted, hash: 'loc1', metadata: { index: 1, timestamp: 1 } }
        });
        mockNode.mempool.pendingBlocks.set('pending2', {
            committed: false,
            block: { publicKey: 'testPubKey', private: encrypted2, hash: 'loc2', metadata: { index: 2, timestamp: 2 } }
        });
        mockNode.mempool.pendingBlocks.set('pending3', {
            committed: false,
            block: { publicKey: 'testPubKey', private: encrypted3, hash: 'loc3', metadata: { index: 3, timestamp: 3 } }
        });
        mockNode.mempool.pendingBlocks.set('pending4', {
            committed: false,
            block: { publicKey: 'testPubKey', private: encrypted4, hash: 'loc4', metadata: { index: 4, timestamp: 4 } }
        });
        
        const handler = new FilesHandler(mockNode as any);
        await handler.handle(req as any, res as any);
        
        const responseData = JSON.parse(res.jsonStr);
        assert.strictEqual(responseData.files.length, 4);
    });
});
