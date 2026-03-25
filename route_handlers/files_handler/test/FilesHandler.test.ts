import assert from 'node:assert';
import { describe, it, beforeEach } from 'node:test';

import { generateRSAKeyPair, encryptPrivatePayload } from '../../../crypto_utils/CryptoUtils';
// import PeerNode from '../../../peer_node/PeerNode';
import { MockPeerNode } from '../../../test/mocks/MockPeerNode';
import { MockRequest } from '../../../test/mocks/MockRequest';
import { MockResponse } from '../../../test/mocks/MockResponse';
import FilesHandler from '../FilesHandler';

describe('Backend: filesHandler Coverage', () => {
    let mockNode: MockPeerNode;
    let req: MockRequest;
    let res: MockResponse;
    let keys: any;

    beforeEach(() => {
        keys = generateRSAKeyPair();
        mockNode = new MockPeerNode({ publicKey: 'testPubKey', privateKey: keys.privateKey });
        mockNode.ownedBlocksCache = [];
        mockNode.ledger = { collection: { find: () => ({ toArray: async () => [] }) } };
        mockNode.mempool = { pendingBlocks: new Map() };

        req = new MockRequest();
        res = new MockResponse();
    });

    it('Returns empty array on blank node payloads', async () => {
        const handler = new FilesHandler(mockNode.asPeerNode());
        await handler.handle(req.asRequest(), res.asResponse());
        
        const responseData = res.body;
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
            toArray: async () => [{ metadata: { index: 5, timestamp: 9999 }, hash: 'hashABC', publicKey: 'testPubKey', payload: encrypted }]
        });
        
        const handler = new FilesHandler(mockNode.asPeerNode());
        await handler.handle(req.asRequest(), res.asResponse());
        
        const responseData = res.body;
        assert.strictEqual(responseData.success, true);
        assert.strictEqual(responseData.files.length, 1);
        
        const file = responseData.files[0];
        assert.strictEqual(file.path, 'doc1.pdf');
        assert.strictEqual(file.location.type, 's3');
        assert.strictEqual(file.location.label, 's3://test-bucket');
        assert.strictEqual(file.versions.length, 1);
        assert.strictEqual(file.versions[0].hash, 'fileHash123');
    });

    it('Filters arrays by target metadata matching requested filters', async () => {
        const encrypted = encryptPrivatePayload(keys.publicKey, { 
            files: [{ path: 'pendingDoc.txt' }] 
        });
        
        mockNode.mempool.pendingBlocks.set('pending-sig', {
            committed: false,
            block: { publicKey: 'testPubKey', payload: encrypted, hash: 'pendingHash' }
        });
        
        const handler = new FilesHandler(mockNode.asPeerNode());
        await handler.handle(req.asRequest(), res.asResponse());
        
        const responseData = res.body;
        assert.strictEqual(responseData.success, true);
        assert.strictEqual(responseData.files.length, 1);
        assert.strictEqual(responseData.files[0].path, 'pendingDoc.txt');
    });

    it('Gracefully catches and returns 500 on internal processor failure', async () => {
        const brokenNode = mockNode.asPeerNode();
        brokenNode.ownedBlocksCache = ['trigger_db_query_hash'];
        // @ts-ignore - explicitly inducing simulated database failure isolating crash handlers natively
        brokenNode.ledger = null;
        
        const handler = new FilesHandler(brokenNode);
        await handler.handle(req.asRequest(), res.asResponse());
        assert.strictEqual(res.statusCode, 500);
        const responseData = res.body;
        assert.strictEqual(responseData.success, false);
    });

    it('Consolidates logical file version timelines mapping sequential hashes', async () => {
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
                { metadata: { index: 1, timestamp: 1000 }, hash: 'b1', publicKey: 'testPubKey', payload: encrypted },
                { metadata: { index: 2, timestamp: 2000 }, hash: 'b2', publicKey: 'testPubKey', payload: encrypted2 }
            ]
        });
        
        const handler = new FilesHandler(mockNode.asPeerNode());
        await handler.handle(req.asRequest(), res.asResponse());
        
        const responseData = res.body;
        assert.strictEqual(responseData.success, true);
        assert.strictEqual(responseData.files.length, 1);
        
        const file = responseData.files[0];
        assert.strictEqual(file.versions.length, 2);
        assert.strictEqual(file.versions[0].hash, 'hash2'); // Newer timestamp sorts first
        assert.strictEqual(file.versions[1].hash, 'hash1');
    });

    it('Traps payload decryption pipeline errors bypassing invalid blocks', async () => {
        mockNode.ownedBlocksCache = ['badBlock'];
        mockNode.ledger.collection.find = () => ({
            toArray: async () => [
                { hash: 'badBlock', publicKey: 'testPubKey', payload: 'CORRUPTED' }
            ]
        });
        
        const handler = new FilesHandler(mockNode.asPeerNode());
        await handler.handle(req.asRequest(), res.asResponse());
        
        const responseData = res.body;
        assert.strictEqual(responseData.success, true);
        assert.strictEqual(responseData.files.length, 0);
    });

    it('Identifies unknown backend storage models casting fallback defaults', async () => {
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
        
        mockNode.ownedBlocksCache = []; // Cover default ownedBlocksCache init
        
        // Add pending block directly to mempool since we cleared owned blocks
        mockNode.mempool.pendingBlocks.set('pending1', {
            committed: false,
            block: { publicKey: 'testPubKey', payload: encrypted, hash: 'loc1', metadata: { index: 1, timestamp: 1 } }
        });
        mockNode.mempool.pendingBlocks.set('pending2', {
            committed: false,
            block: { publicKey: 'testPubKey', payload: encrypted2, hash: 'loc2', metadata: { index: 2, timestamp: 2 } }
        });
        mockNode.mempool.pendingBlocks.set('pending3', {
            committed: false,
            block: { publicKey: 'testPubKey', payload: encrypted3, hash: 'loc3', metadata: { index: 3, timestamp: 3 } }
        });
        mockNode.mempool.pendingBlocks.set('pending4', {
            committed: false,
            block: { publicKey: 'testPubKey', payload: encrypted4, hash: 'loc4', metadata: { index: 4, timestamp: 4 } }
        });
        
        const handler = new FilesHandler(mockNode.asPeerNode());
        await handler.handle(req.asRequest(), res.asResponse());
        
        const responseData = res.body;
        assert.strictEqual(responseData.files.length, 4);
    });
});
