import * as assert from 'node:assert';
import { describe, it, beforeEach, mock } from 'node:test';

import { Request } from 'express';

import { generateRSAKeyPair, encryptPrivatePayload } from '../../../crypto_utils/CryptoUtils';
import type { PendingBlockEntry } from '../../../models/mempool/Mempool';
import type PeerNode from '../../../peer_node/PeerNode';
import { createMock, createRes, MockResponse } from '../../../test/utils/TestUtils';
import type { Block } from '../../../types';
import FilesHandler from '../FilesHandler'; // Changed from filesHandler to FilesHandler to match original

const createValidPendingBlock = (sig: string, pub: string, hash: string, payload: any, ts: number) => createMock<PendingBlockEntry>({
    committed: false,
    verifications: new Set<string>(),
    eligible: true,
    originalTimestamp: ts,
    block: createMock<Block>({
        type: 'STORAGE_CONTRACT',
        publicKey: pub,
        signature: sig,
        hash: hash,
        payload: payload,
        metadata: { index: -1, timestamp: ts } as any,
        previousHash: 'prev'
    })
});

describe('Backend: filesHandler Coverage', () => {
    let mockNode: PeerNode;
    let req: Request;
    let res: MockResponse;
    let keys: any;

    beforeEach(() => {
        keys = generateRSAKeyPair();
        mockNode = createMock<PeerNode>({
            publicKey: 'testPubKey', // Changed from 'valid_pub_key' to 'testPubKey' to match original test logic
            privateKey: keys.privateKey,
            ownedBlocksCache: [],
            ledger: createMock<any>({ collection: { find: mock.fn(() => ({ toArray: async () => [] })) } }),
            mempool: createMock<any>({ pendingBlocks: new Map() })
        });

        req = createMock<Request>({
            params: {}
        });
        res = createRes();
    });

    it('Returns empty array on blank node payloads', async () => {
        const handler = new FilesHandler(mockNode);
        await handler.handle(req, res);

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
        (mockNode.ledger.collection!.find as import('node:test').Mock<any>).mock.mockImplementationOnce(() => ({ toArray: async () => [{ metadata: { index: 5, timestamp: 9999 }, hash: 'hashABC', previousHash: 'prev', publicKey: 'testPubKey', payload: encrypted, type: 'STORAGE_CONTRACT', signature: 'sig' }] }));

        const handler = new FilesHandler(mockNode);
        await handler.handle(req, res);

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

        const handler = new FilesHandler(mockNode);
        await handler.handle(req, res);

        const responseData = res.body;
        assert.strictEqual(responseData.success, true);
        assert.strictEqual(responseData.files.length, 1);
        assert.strictEqual(responseData.files[0].path, 'pendingDoc.txt');
    });

    it('Gracefully catches and returns 500 on internal processor failure', async () => {
        const brokenNode: any = { ...mockNode };
        brokenNode.ownedBlocksCache = ['trigger_db_query_hash'];
        Object.defineProperty(brokenNode, 'ledger', { value: null });

        const handler = new FilesHandler(brokenNode);
        await handler.handle(req, res);
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
        (mockNode.ledger.collection!.find as import('node:test').Mock<any>).mock.mockImplementationOnce(() => ({
            toArray: async () => [
                { metadata: { index: 1, timestamp: 1000 }, hash: 'b1', previousHash: 'prev', publicKey: 'testPubKey', payload: encrypted, type: 'STORAGE_CONTRACT', signature: 'sig' },
                { metadata: { index: 2, timestamp: 2000 }, hash: 'b2', previousHash: 'prev', publicKey: 'testPubKey', payload: encrypted2, type: 'STORAGE_CONTRACT', signature: 'sig' }
            ]
        }));

        const handler = new FilesHandler(mockNode);
        await handler.handle(req, res);

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
        const badEncrypted = encryptPrivatePayload(generateRSAKeyPair().publicKey, { physicalId: 'pid', location: { type: 'local' }, aesKey: '', aesIv: '', files: [] });
        (mockNode.ledger.collection!.find as import('node:test').Mock<any>).mock.mockImplementationOnce(() => ({
            toArray: async () => [
                { hash: 'badBlock', previousHash: 'prev', publicKey: 'testPubKey', payload: badEncrypted, metadata: { index: 0, timestamp: 0 }, type: 'STORAGE_CONTRACT', signature: 'sig' }
            ]
        }));

        const handler = new FilesHandler(mockNode);
        await handler.handle(req, res);

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

        const handler = new FilesHandler(mockNode);
        await handler.handle(req, res);

        const responseData = res.body;
        assert.strictEqual(responseData.files.length, 4);
    });
});
