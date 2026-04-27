import assert from 'node:assert';
import { describe, it, beforeEach, mock } from 'node:test';



import type { Request, Response } from 'express';
import { Collection, FindCursor, ObjectId, WithId } from 'mongodb';

import { generateRSAKeyPair, encryptPrivatePayload } from '../../../crypto_utils/CryptoUtils';
import type Ledger from '../../../ledger/Ledger';
import type Mempool from '../../../models/mempool/Mempool';
import type PeerNode from '../../../peer_node/PeerNode';
import { createMock } from '../../../test/utils/TestUtils';
import type { Block } from '../../../types';
import BlocksHandler from '../BlocksHandler';

const createValidPendingBlock = (sig: string, pub: string, payload: any, ts: number): any => ({
    committed: false,
    verifications: new Set<string>(),
    eligible: true,
    originalTimestamp: ts,
    block: {
        hash: 'hash_' + sig,
        previousHash: 'prev',
        type: 'STORAGE_CONTRACT' as const,
        metadata: { index: -1, timestamp: ts },
        signerAddress: pub,
        signature: sig,
        payload: payload
    }
});

describe('Backend: blocksHandler Coverage', () => {
    const mockCollectionFind = mock.fn<() => FindCursor<WithId<Block>>>();
    let mockCollection: Collection<Block>;
    let mockNode: PeerNode;
    let req: Request;
    let mockResponseJson: import('node:test').Mock<any>;
    let mockResponseStatus: import('node:test').Mock<any>;
    let res: Response;
    let keys: { publicKey: string, privateKey: string };

    beforeEach(() => {
        keys = generateRSAKeyPair();
        mockCollectionFind.mock.mockImplementation(() => createMock<FindCursor<WithId<Block>>>({
            sort: () => createMock<FindCursor<WithId<Block>>>({ toArray: async () => [] })
        }));
        mockCollection = createMock<Collection<Block>>({ find: mockCollectionFind as any });
        
        mockNode = createMock<PeerNode>({
            walletAddress: 'testPubKey',

            ledger: createMock<Ledger>({ collection: mockCollection }),
            mempool: createMock<Mempool>({ pendingBlocks: new Map() })
        });

        req = createMock<Request>({ query: {} });
        mockResponseJson = mock.fn<(_unusedBody?: any) => Response>();
        let currentStatus = 200;
        mockResponseStatus = mock.fn<(_unusedCode: number) => Response>((code: number) => {
            currentStatus = code;
            return res;
        });
        res = createMock<Response>({
            json: mockResponseJson as any,
            send: mockResponseJson as any,
            status: mockResponseStatus as any,
            get statusCode() { return currentStatus; }
        });
    });

    it('Returns empty blocks list', async () => {
        const handler = new BlocksHandler(mockNode);
        await handler.handle(req, res);
        
        const responseData = mockResponseJson.mock.calls.pop()?.arguments[0];
        assert.strictEqual(responseData.success, true);
        assert.strictEqual(responseData.blocks.length, 0);
    });

    it('Returns fetched blocks', async () => {
        const encrypted = encryptPrivatePayload(keys.publicKey, { files: [{ path: 'test.txt' }] });
        mockCollectionFind.mock.mockImplementationOnce(() => createMock<FindCursor<WithId<Block>>>({
            sort: () => createMock<FindCursor<WithId<Block>>>({
                toArray: async () => [createMock<WithId<Block>>({
                    _id: new ObjectId('000000000000000000000001'),
                    metadata: { index: 1, timestamp: 0 }, hash: 'hash1', previousHash: 'prev', signerAddress: 'testPubKey', payload: encrypted, type: 'STORAGE_CONTRACT', signature: 'sig'
                })]
            })
        }));

        const handler = new BlocksHandler(mockNode);
        await handler.handle(req, res);
        
        const responseData = mockResponseJson.mock.calls.pop()?.arguments[0];
        assert.strictEqual(responseData.blocks.length, 1);
        assert.strictEqual(responseData.blocks[0].hash, 'hash1');
    });

    it('Filters by local queries', async () => {
        const encryptedMatch = encryptPrivatePayload(keys.publicKey, { files: [{ path: 'match-this.txt' }] });
        const encryptedNoMatch = encryptPrivatePayload(keys.publicKey, { files: [{ path: 'other.txt' }] });
        mockCollectionFind.mock.mockImplementationOnce(() => createMock<FindCursor<WithId<Block>>>({
            sort: () => createMock<FindCursor<WithId<Block>>>({
                toArray: async () => [
                    createMock<WithId<Block>>({ _id: new ObjectId('000000000000000000000001'), metadata: { index: 1, timestamp: 0 }, hash: 'hash1', previousHash: 'prev', signerAddress: 'testPubKey', payload: encryptedMatch, type: 'STORAGE_CONTRACT', signature: 'sig1' }),
                    createMock<WithId<Block>>({ _id: new ObjectId('000000000000000000000002'), metadata: { index: 2, timestamp: 0 }, hash: 'hash2', previousHash: 'prev', signerAddress: 'testPubKey', payload: encryptedNoMatch, type: 'STORAGE_CONTRACT', signature: 'sig2' })
                ]
            })
        }));

        req.query.q = 'match';
        
        const handler = new BlocksHandler(mockNode);
        await handler.handle(req, res);
        
        const responseData = mockResponseJson.mock.calls.pop()?.arguments[0];
        assert.strictEqual(responseData.blocks.length, 1);
        assert.strictEqual(responseData.blocks[0].hash, 'hash1');
    });
    
    it('Appends pending blocks', async () => {
        const encrypted = encryptPrivatePayload(keys.publicKey, { files: [{ path: 'pending.txt' }] });
        mockNode.mempool!.pendingBlocks.set('some-sig', createValidPendingBlock('some-sig', 'testPubKey', encrypted, 12345));

        const handler = new BlocksHandler(mockNode);
        await handler.handle(req, res);

        const responseData = mockResponseJson.mock.calls.pop()?.arguments[0];
        assert.strictEqual(responseData.blocks.length, 1);
        assert.strictEqual(responseData.blocks[0].metadata.index, -1);
    });

    it('Returns 500 error on failure', async () => {
        const handler = new BlocksHandler(createMock<PeerNode>({ ledger: undefined }));
        await handler.handle(req, res);
        assert.strictEqual(mockResponseStatus.mock.calls.pop()?.arguments[0], 500);
        const responseData = mockResponseJson.mock.calls.pop()?.arguments[0];
        assert.strictEqual(responseData.success, false);
    });

    it('Filters by own blocks', async () => {
        const encrypted = encryptPrivatePayload(keys.publicKey, { files: [{ path: 'test.txt' }] });
        
        mockNode.mempool!.pendingBlocks.set('some-sig', createValidPendingBlock('some-sig', 'otherKey', encrypted, 12345));
        mockNode.mempool!.pendingBlocks.set('some-sig2', createValidPendingBlock('some-sig2', 'testPubKey', encrypted, 123456));

        req.query.own = 'true';

        const handler = new BlocksHandler(mockNode);
        await handler.handle(req, res);
        
        const responseData = mockResponseJson.mock.calls.pop()?.arguments[0];
        // Only the pending block with testPubKey should be returned
        assert.strictEqual(responseData.blocks.length, 1);
        assert.strictEqual(responseData.blocks[0].signerAddress, 'testPubKey');
    });

    it('Sorts pending blocks in ASC and DESC', async () => {
        const encrypted = encryptPrivatePayload(keys.publicKey, { files: [{ path: 'test.txt' }] });
        
        mockNode.mempool!.pendingBlocks.set('block1', createValidPendingBlock('b1', 'testPubKey', encrypted, 1000));
        mockNode.mempool!.pendingBlocks.set('block2', createValidPendingBlock('b2', 'testPubKey', encrypted, 2000));

        // Test ASC
        req.query.sort = 'asc';
        let handler = new BlocksHandler(mockNode as PeerNode);
        await handler.handle(req as Request, res as Response);
        let resp = mockResponseJson.mock.calls.pop()?.arguments[0];
        assert.strictEqual(resp.blocks[0].signature, 'b1');
        assert.strictEqual(resp.blocks[1].signature, 'b2');

        // Test DESC
        mockResponseJson = mock.fn<(_unusedBody?: any) => Response>();
        let currentStatus = 200;
        mockResponseStatus = mock.fn<(_unusedCode: number) => Response>((code: number) => {
            currentStatus = code;
            return res;
        });
        res = createMock<Response>({
            json: mockResponseJson as any,
            send: mockResponseJson as any,
            status: mockResponseStatus as any,
            get statusCode() { return currentStatus; }
        });
        req.query.sort = 'desc';
        handler = new BlocksHandler(mockNode as PeerNode);
        await handler.handle(req as Request, res as Response);
        resp = mockResponseJson.mock.calls.pop()?.arguments[0];
        assert.strictEqual(resp.blocks[0].signature, 'b2');
        assert.strictEqual(resp.blocks[1].signature, 'b1');
    });

    it('Catches decryption errors', async () => {
        const encryptedMatch = encryptPrivatePayload(keys.publicKey, { files: [{ path: 'match-this.txt' }] });
        mockCollectionFind.mock.mockImplementationOnce(() => createMock<FindCursor<WithId<Block>>>({
            sort: () => createMock<FindCursor<WithId<Block>>>({
                toArray: async () => [
                    createMock<WithId<Block>>({ _id: new ObjectId('000000000000000000000001'), metadata: { index: 1, timestamp: 0 }, hash: 'hash1', previousHash: 'prev', signerAddress: 'testPubKey', payload: encryptPrivatePayload(keys.publicKey, { physicalId: 'pid', location: { type: 'local' }, aesKey: '', aesIv: '', files: [] }), type: 'STORAGE_CONTRACT', signature: 'sig1' }),
                    createMock<WithId<Block>>({ _id: new ObjectId('000000000000000000000002'), metadata: { index: 2, timestamp: 0 }, hash: 'hash2', previousHash: 'prev', signerAddress: 'testPubKey', payload: encryptedMatch, type: 'STORAGE_CONTRACT', signature: 'sig2' })
                ]
            })
        }));

        req.query.q = 'match';
        const handler = new BlocksHandler(mockNode);
        await handler.handle(req, res);
        
        const responseData = mockResponseJson.mock.calls.pop()?.arguments[0];
        assert.strictEqual(responseData.blocks.length, 1);
        assert.strictEqual(responseData.blocks[0].hash, 'hash2');
    });
});
