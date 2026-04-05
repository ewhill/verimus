import * as assert from 'node:assert';
import { describe, it, beforeEach, mock } from 'node:test';

import { Request, Response } from 'express';
import { Collection, FindCursor, ObjectId, WithId } from 'mongodb';

import { generateRSAKeyPair } from '../../../crypto_utils/CryptoUtils';
import type Ledger from '../../../ledger/Ledger';
import type { PendingBlockEntry } from '../../../models/mempool/Mempool';
import type Mempool from '../../../models/mempool/Mempool';
import type PeerNode from '../../../peer_node/PeerNode';
import { createMock } from '../../../test/utils/TestUtils';
import type { Block, BlockMetadata } from '../../../types';
import FilesHandler from '../FilesHandler';

const createValidPendingBlock = (sig: string, pub: string, hash: string, payload: any, ts: number) => createMock<PendingBlockEntry>({
    committed: false,
    verifications: new Set<string>(),
    eligible: true,
    originalTimestamp: ts,
    block: createMock<Block>({
        type: 'STORAGE_CONTRACT',
        signerAddress: pub,
        signature: sig,
        hash: hash,
        payload: payload,
        metadata: { index: -1, timestamp: ts } as BlockMetadata,
        previousHash: 'prev'
    })
});

describe('Backend: filesHandler Coverage', () => {
    let mockNode: PeerNode;
    let req: Request;
    let res: Response;
    let mockStatus: import('node:test').Mock<any>;
    let mockJson: import('node:test').Mock<any>;
    let keys: any;
    const mockCollectionFind = mock.fn<() => FindCursor<WithId<Block>>>();

    beforeEach(() => {
        keys = generateRSAKeyPair();
        mockNode = createMock<PeerNode>({
            walletAddress: 'testPubKey',
            publicKey: 'testPubKey',
            privateKey: keys.privateKey,
            ownedBlocksCache: [],
            ledger: createMock<Ledger>({
                collection: createMock<Collection<Block>>({
                    find: mockCollectionFind as any
                })
            }),
            mempool: createMock<Mempool>({ pendingBlocks: new Map() })
        });

        req = createMock<Request>({
            params: {}
        });
        mockStatus = mock.fn<(_unusedCode: number) => Response>(function () { return res; }) as import('node:test').Mock<any>;
        mockJson = mock.fn<(_unusedBody?: any) => Response>(function () { return res; }) as import('node:test').Mock<any>;
        res = createMock<Response>({ status: mockStatus, json: mockJson });
    });

    it('Returns empty array on blank node payloads', async () => {
        mockCollectionFind.mock.mockImplementation(() => createMock<FindCursor<WithId<Block>>>({ toArray: async () => [] }));

        const handler = new FilesHandler(mockNode);
        await handler.handle(req, res);

        const responseData = mockJson.mock.calls[0].arguments[0];
        assert.strictEqual(responseData.success, true);
        assert.strictEqual(responseData.files.length, 0);
    });

    it('Traverses linear block histories merging virtual structured directory paths', async () => {
        mockNode.ownedBlocksCache = ['hashABC'];
        mockCollectionFind.mock.mockImplementation(() =>
            createMock<FindCursor<WithId<Block>>>({
                toArray: async () => [
                    createMock<WithId<Block>>({
                        _id: new ObjectId('000000000000000000000000'),
                        metadata: {
                            index: 5,
                            timestamp: 9999
                        },
                        hash: 'hashABC',
                        previousHash: 'prev',
                        signerAddress: 'testPubKey',
                        payload: {
                            encryptedPayloadBase64: Buffer.from(JSON.stringify({
                                location: { type: 's3', bucket: 'test-bucket' },
                                files: [{ path: 'doc1.pdf', size: 1000, hash: 'fileHash123' }]
                            })).toString('base64'),
                            encryptedKeyBase64: 'DEPRECATED_PHASE5',
                            encryptedIvBase64: 'DEPRECATED_PHASE5',
                            encryptedAuthTagBase64: 'DEPRECATED_PHASE5'
                        },
                        type: 'STORAGE_CONTRACT',
                        signature: 'sig'
                    })
                ]
            })
        );

        const handler = new FilesHandler(mockNode);
        await handler.handle(req, res);

        const responseData = mockJson.mock.calls[0].arguments[0];
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
        mockNode.mempool.pendingBlocks.set(
            'pending-sig',
            createValidPendingBlock(
                'pending-sig',
                'testPubKey',
                'pendingHash',
                {
                    encryptedPayloadBase64: Buffer.from(JSON.stringify({
                        files: [{
                            path: 'pendingDoc.txt',
                            size: 1000,
                            hash: 'fileHash123'
                        }]
                    })).toString('base64'),
                    encryptedKeyBase64: 'DEPRECATED_PHASE5',
                    encryptedIvBase64: 'DEPRECATED_PHASE5',
                    encryptedAuthTagBase64: 'DEPRECATED_PHASE5'
                },
                100
            )
        );
        const handler = new FilesHandler(mockNode);
        await handler.handle(req, res);

        const responseData = mockJson.mock.calls[0].arguments[0];
        assert.strictEqual(responseData.success, true);
        assert.strictEqual(responseData.files.length, 1);
        assert.strictEqual(responseData.files[0].path, 'pendingDoc.txt');
    });

    it('Gracefully catches and returns 500 on internal processor failure', async () => {
        const brokenNode = createMock<PeerNode>({
            ...mockNode,
            walletAddress: 'testPubKey',
            ownedBlocksCache: ['trigger_db_query_hash'],
            ledger: createMock<Ledger>({
                collection: createMock<Collection<Block>>({
                    find: () => {
                        throw new Error('db crash test');
                    }
                })
            })
        });

        const handler = new FilesHandler(brokenNode);
        await handler.handle(req, res);

        assert.strictEqual(mockStatus.mock.calls.length, 1);
        const responseStatus = mockStatus.mock.calls[0].arguments[0];
        assert.strictEqual(responseStatus, 500);

        assert.strictEqual(mockJson.mock.calls.length, 1);
        const responseData = mockJson.mock.calls[0].arguments[0];
        assert.strictEqual(responseData.success, false);
    });

    it('Consolidates logical file version timelines mapping sequential hashes', async () => {
        mockNode.ownedBlocksCache = ['b1', 'b2'];
        mockCollectionFind.mock.mockImplementation(() =>
            createMock<FindCursor<WithId<Block>>>({
                toArray: async () => [
                    createMock<WithId<Block>>({
                        _id: new ObjectId('000000000000000000000001'),
                        metadata: { index: 1, timestamp: 1000 },
                        hash: 'b1',
                        previousHash: 'prev',
                        signerAddress: 'testPubKey',
                        payload: {
                            encryptedPayloadBase64: Buffer.from(JSON.stringify({
                                location: { type: 'local', storageDir: '/tmp' },
                                files: [{ path: 'doc1.pdf', size: 1000, hash: 'hash1' }]
                            })).toString('base64'),
                            encryptedKeyBase64: 'DEPRECATED_PHASE5',
                            encryptedIvBase64: 'DEPRECATED_PHASE5',
                            encryptedAuthTagBase64: 'DEPRECATED_PHASE5'
                        },
                        type: 'STORAGE_CONTRACT',
                        signature: 'sig'
                    }),
                    createMock<WithId<Block>>({
                        _id: new ObjectId('000000000000000000000002'),
                        metadata: { index: 2, timestamp: 2000 },
                        hash: 'b2',
                        previousHash: 'prev',
                        signerAddress: 'testPubKey',
                        payload: {
                            encryptedPayloadBase64: Buffer.from(JSON.stringify({
                                location: { type: 'local', storageDir: '/tmp' },
                                files: [{ path: 'doc1.pdf', size: 1200, hash: 'hash2' }]
                            })).toString('base64'),
                            encryptedKeyBase64: 'DEPRECATED_PHASE5',
                            encryptedIvBase64: 'DEPRECATED_PHASE5',
                            encryptedAuthTagBase64: 'DEPRECATED_PHASE5'
                        },
                        type: 'STORAGE_CONTRACT',
                        signature: 'sig'
                    })
                ]
            }));

        const handler = new FilesHandler(mockNode);
        await handler.handle(req, res);

        assert.strictEqual(mockJson.mock.calls.length, 1);
        const responseData = mockJson.mock.calls[0].arguments[0];
        assert.strictEqual(responseData.success, true);
        assert.strictEqual(responseData.files.length, 1);

        const file = responseData.files[0];
        assert.strictEqual(file.versions.length, 2);
        assert.strictEqual(file.versions[0].hash, 'hash2'); // Newer timestamp sorts first
        assert.strictEqual(file.versions[1].hash, 'hash1');
    });

    it('Traps payload decryption pipeline errors bypassing invalid blocks', async () => {
        mockNode.ownedBlocksCache = ['badBlock'];
        mockCollectionFind.mock.mockImplementation(() =>
            createMock<FindCursor<WithId<Block>>>({
                toArray: async () => [
                    createMock<WithId<Block>>({
                        _id: new ObjectId('000000000000000000000003'),
                        metadata: { index: 0, timestamp: 0 },
                        hash: 'badBlock',
                        previousHash: 'prev',
                        signerAddress: 'testPubKey',
                        payload: {
                            encryptedPayloadBase64: Buffer.from(JSON.stringify({
                                physicalId: 'pid',
                                location: { type: 'local' },
                                aesKey: '',
                                aesIv: '',
                                files: []
                            })).toString('base64'),
                            encryptedKeyBase64: 'DEPRECATED_PHASE5',
                            encryptedIvBase64: 'DEPRECATED_PHASE5',
                            encryptedAuthTagBase64: 'DEPRECATED_PHASE5'
                        },
                        type: 'STORAGE_CONTRACT',
                        signature: 'sig'
                    })
                ]
            }));

        const handler = new FilesHandler(mockNode);
        await handler.handle(req, res);

        assert.strictEqual(mockJson.mock.calls.length, 1);
        const responseData = mockJson.mock.calls[0].arguments[0];
        assert.strictEqual(responseData.success, true);
        assert.strictEqual(responseData.files.length, 0);
    });

    it('Identifies unknown backend storage models casting fallback defaults', async () => {
        mockNode.ownedBlocksCache = []; // Cover default ownedBlocksCache init
        // Add pending block directly to mempool since we cleared owned blocks
        mockNode.mempool.pendingBlocks.set(
            'pending1',
            createValidPendingBlock(
                'pending1',
                'testPubKey',
                'loc1',
                {
                    encryptedPayloadBase64: Buffer.from(JSON.stringify({
                        files: [{ path: 'no-loc.txt' }]
                    })).toString('base64'),
                    encryptedKeyBase64: 'DEPRECATED_PHASE5',
                    encryptedIvBase64: 'DEPRECATED_PHASE5',
                    encryptedAuthTagBase64: 'DEPRECATED_PHASE5'
                },
                1
            )
        );
        mockNode.mempool.pendingBlocks.set(
            'pending2',
            createValidPendingBlock(
                'pending2',
                'testPubKey',
                'loc2',
                {
                    encryptedPayloadBase64: Buffer.from(JSON.stringify({
                        location: { type: 'samba', share: '\\\\share' },
                        files: [{ path: 'samba.txt' }]
                    })).toString('base64'),
                    encryptedKeyBase64: 'DEPRECATED_PHASE5',
                    encryptedIvBase64: 'DEPRECATED_PHASE5',
                    encryptedAuthTagBase64: 'DEPRECATED_PHASE5'
                },
                2
            )
        );
        mockNode.mempool.pendingBlocks.set(
            'pending3',
            createValidPendingBlock(
                'pending3',
                'testPubKey',
                'loc3',
                {
                    encryptedPayloadBase64: Buffer.from(JSON.stringify({
                        location: { type: 'remote-fs', host: 'test-host', dir: '/test-dir' },
                        files: [{ path: 'remote.txt' }]
                    })).toString('base64'),
                    encryptedKeyBase64: 'DEPRECATED_PHASE5',
                    encryptedIvBase64: 'DEPRECATED_PHASE5',
                    encryptedAuthTagBase64: 'DEPRECATED_PHASE5'
                }, 3));
        mockNode.mempool.pendingBlocks.set(
            'pending4',
            createValidPendingBlock(
                'pending4',
                'testPubKey',
                'loc4',
                {
                    encryptedPayloadBase64: Buffer.from(JSON.stringify({
                        location: { type: 'glacier', vault: 'my-vault' },
                        files: [{ path: 'glacier.txt' }]
                    })).toString('base64'),
                    encryptedKeyBase64: 'DEPRECATED_PHASE5',
                    encryptedIvBase64: 'DEPRECATED_PHASE5',
                    encryptedAuthTagBase64: 'DEPRECATED_PHASE5'
                }, 4));

        const handler = new FilesHandler(mockNode);
        await handler.handle(req, res);

        assert.strictEqual(mockJson.mock.calls.length, 1);
        const responseData = mockJson.mock.calls[0].arguments[0];
        assert.strictEqual(responseData.success, true);
        assert.strictEqual(responseData.files.length, 4);
    });
});
