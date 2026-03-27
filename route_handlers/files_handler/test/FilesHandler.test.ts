import assert from 'node:assert';
import { describe, it, beforeEach, mock } from 'node:test';

import { generateRSAKeyPair, encryptPrivatePayload } from '../../../crypto_utils/CryptoUtils';
// import PeerNode from '../../../peer_node/PeerNode';
import { MockPeerNode } from '../../../test/mocks/MockPeerNode';
import { MockRequest } from '../../../test/mocks/MockRequest';
import { MockResponse } from '../../../test/mocks/MockResponse';
import { createMongoCursorStub } from '../../../test/utils/StubFactory';
import FilesHandler from '../FilesHandler';

const createValidPendingBlock = (sig: string, pub: string, hash: string, payload: any, ts: number) => ({
    committed: false,
    verifications: new Set<string>(),
    eligible: true,
    originalTimestamp: ts,
    block: {
        hash: hash,
        previousHash: 'prev',
        type: 'STORAGE_CONTRACT' as const,
        metadata: { index: -1, timestamp: ts },
        publicKey: pub,
        signature: sig,
        payload: payload
    }
});

describe('Backend: filesHandler Coverage', () => {
    let mockNode: MockPeerNode;
    let req: MockRequest;
    let res: MockResponse;
    let keys: any;

    beforeEach(() => {
        keys = generateRSAKeyPair();
        mockNode = new MockPeerNode({ publicKey: 'testPubKey', privateKey: keys.privateKey });
        mockNode.ownedBlocksCache = [];
        mock.method(mockNode.ledger.collection!, 'find', () => createMongoCursorStub([]));
        mockNode.mempool.pendingBlocks = new Map();

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
        mock.method(mockNode.ledger.collection!, 'find', () => createMongoCursorStub([{ metadata: { index: 5, timestamp: 9999 }, hash: 'hashABC', previousHash: 'prev', publicKey: 'testPubKey', payload: encrypted, type: 'STORAGE_CONTRACT', signature: 'sig' }]));
        
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
        
        mockNode.mempool.pendingBlocks.set('pending-sig', createValidPendingBlock('pending-sig', 'testPubKey', 'pendingHash', encrypted, 100));
        
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
        Object.defineProperty(brokenNode, 'ledger', { value: null });
        
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
        mock.method(mockNode.ledger.collection!, 'find', () => createMongoCursorStub([
            { metadata: { index: 1, timestamp: 1000 }, hash: 'b1', previousHash: 'prev', publicKey: 'testPubKey', payload: encrypted, type: 'STORAGE_CONTRACT', signature: 'sig' },
            { metadata: { index: 2, timestamp: 2000 }, hash: 'b2', previousHash: 'prev', publicKey: 'testPubKey', payload: encrypted2, type: 'STORAGE_CONTRACT', signature: 'sig' }
        ]));
        
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
        const badEncrypted = encryptPrivatePayload(generateRSAKeyPair().publicKey, { physicalId: 'pid', location: { type: 'local'}, aesKey: '', aesIv: '', files: [] });
        mock.method(mockNode.ledger.collection!, 'find', () => createMongoCursorStub([
            { hash: 'badBlock', previousHash: 'prev', publicKey: 'testPubKey', payload: badEncrypted, metadata: { index: 0, timestamp: 0 }, type: 'STORAGE_CONTRACT', signature: 'sig' }
        ]));
        
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
        mockNode.mempool.pendingBlocks.set('pending1', createValidPendingBlock('pending1', 'testPubKey', 'loc1', encrypted, 1));
        mockNode.mempool.pendingBlocks.set('pending2', createValidPendingBlock('pending2', 'testPubKey', 'loc2', encrypted2, 2));
        mockNode.mempool.pendingBlocks.set('pending3', createValidPendingBlock('pending3', 'testPubKey', 'loc3', encrypted3, 3));
        mockNode.mempool.pendingBlocks.set('pending4', createValidPendingBlock('pending4', 'testPubKey', 'loc4', encrypted4, 4));
        
        const handler = new FilesHandler(mockNode.asPeerNode());
        await handler.handle(req.asRequest(), res.asResponse());
        
        const responseData = res.body;
        assert.strictEqual(responseData.files.length, 4);
    });
});
