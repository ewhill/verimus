import assert from 'node:assert';
import { describe, it, mock } from 'node:test';


import type { Request, Response } from 'express';
import type { Collection } from 'mongodb';

import * as cryptoUtils from '../../../crypto_utils/CryptoUtils';
import type Ledger from '../../../ledger/Ledger';
import type Mempool from '../../../models/mempool/Mempool';
import type PeerNode from '../../../peer_node/PeerNode';
import type { Block } from '../../../types';
import PrivatePayloadHandler from '../PrivatePayloadHandler';

import { createMock } from '../../../test/utils/TestUtils';

describe('Backend: privatePayloadHandler Coverage', () => {

    it('Returns 404 for nonexistent block hash checking ledger and mempool', async () => {
        const mockCollection = createMock<Collection<Block>>({ find: mock.fn(() => ({ toArray: async () => [] })) } as any);
        const mockNode: Partial<PeerNode> = { 
            ledger: { collection: mockCollection } as Ledger, 
            mempool: { pendingBlocks: new Map() } as Mempool 
        };
        const handler = new PrivatePayloadHandler(mockNode as PeerNode);

        const req = createMock<Request>({ params: { hash: 'nonexistent' } } as any);
        const res = createMock<Response>({});
        res.status = mock.fn(function() { return res; }) as any;
        res.json = mock.fn(function() { return res; }) as any;
        res.send = mock.fn(function() { return res; }) as any;

        await handler.handle(req as Request, res as Response);
        assert.strictEqual((res.status as import('node:test').Mock<any>).mock.calls[0]?.arguments[0], 404);
        assert.strictEqual((res.json as import('node:test').Mock<any>).mock.calls[0]?.arguments[0]?.success, false);
    });

    it('Returns 403 when public key mismatches authorization', async () => {
        const { publicKey: otherPubKey } = cryptoUtils.generateRSAKeyPair();
        const payload = cryptoUtils.encryptPrivatePayload(otherPubKey, { physicalId: 'pid', location: { type: 'local' }, aesKey: '', aesIv: '', files: [] });
        const mockCollection = createMock<Collection<Block>>({ find: mock.fn(() => ({ toArray: async () => [{ hash: 'exists', previousHash: 'prev', publicKey: otherPubKey, signature: '', payload: payload, type: 'STORAGE_CONTRACT', metadata: { index: 0, timestamp: 0 } }] })) } as any);
        
        const mockNode: Partial<PeerNode> = { 
            publicKey: 'MY_KEY', 
            ledger: { collection: mockCollection } as Ledger 
        };
        const handler = new PrivatePayloadHandler(mockNode as PeerNode);

        const req = createMock<Request>({ params: { hash: 'exists' } } as any);
        const res = createMock<Response>({});
        res.status = mock.fn(function() { return res; }) as any;
        res.json = mock.fn(function() { return res; }) as any;
        res.send = mock.fn(function() { return res; }) as any;

        await handler.handle(req as Request, res as Response);
        assert.strictEqual((res.status as import('node:test').Mock<any>).mock.calls[0]?.arguments[0], 403);
    });

    it('Catches exceptions and returns 500 error mapping', async () => {
        const mockCollection = createMock<Collection<Block>>({ find: mock.fn(() => { throw new Error('DB Error'); }) } as any);
        const mockNode: Partial<PeerNode> = { ledger: { collection: mockCollection } as Ledger };
        const handler = new PrivatePayloadHandler(mockNode as PeerNode);

        const req = createMock<Request>({ params: { hash: 'exists' } } as any);
        const res = createMock<Response>({});
        res.status = mock.fn(function() { return res; }) as any;
        res.json = mock.fn(function() { return res; }) as any;
        res.send = mock.fn(function() { return res; }) as any;

        await handler.handle(req as Request, res as Response);
        assert.strictEqual((res.status as import('node:test').Mock<any>).mock.calls[0]?.arguments[0], 500);
    });

    it('Gets block from mempool when missing in ledger', async () => {
        const { publicKey } = cryptoUtils.generateRSAKeyPair();
        const mockBlock = { hash: 'memhash', publicKey: publicKey, payload: cryptoUtils.encryptPrivatePayload(publicKey, { physicalId: 'pid', location: { type: 'local' }, aesKey: '', aesIv: '', files: [] }), signature: 'bad_sig', type: 'STORAGE_CONTRACT' as const, previousHash: 'prev', metadata: { index: -1, timestamp: 12345 } };
        
        const mockCollection = createMock<Collection<Block>>({ find: mock.fn(() => ({ toArray: async () => [] })) } as any);
        const mockNode: Partial<PeerNode> = { 
            publicKey, 
            ledger: { collection: mockCollection } as Ledger,
            mempool: { pendingBlocks: new Map([['memhash', { block: mockBlock, committed: false, verifications: new Set(), eligible: true, originalTimestamp: 0 }]]) } as unknown as Mempool
        };
        const handler = new PrivatePayloadHandler(mockNode as PeerNode);

        const req = createMock<Request>({ params: { hash: 'memhash' } } as any);
        const res = createMock<Response>({});
        res.status = mock.fn(function() { return res; }) as any;
        res.json = mock.fn(function() { return res; }) as any;
        res.send = mock.fn(function() { return res; }) as any;

        await handler.handle(req as Request, res as Response);
        // It should reach signature verification and fail there, which gives 401, confirming it found the block in mempool
        assert.strictEqual((res.status as import('node:test').Mock<any>).mock.calls[0]?.arguments[0], 401);
    });

    it('Returns 401 when signature is invalid', async () => {
        const { publicKey, privateKey } = cryptoUtils.generateRSAKeyPair();
        const payload = cryptoUtils.encryptPrivatePayload(publicKey, { physicalId: 'pid', location: { type: 'local' }, aesKey: '', aesIv: '', files: [] });
        
        const mockCollection = createMock<Collection<Block>>({ find: mock.fn(() => ({ toArray: async () => [{ hash: 'validh', previousHash: 'prev', publicKey: publicKey, payload: payload, signature: 'bad_sig', type: 'STORAGE_CONTRACT', metadata: { index: 0, timestamp: 0 } }] })) } as any);
        const mockNode: Partial<PeerNode> = { 
            publicKey, 
            privateKey,
            ledger: { collection: mockCollection } as Ledger
        };
        const handler = new PrivatePayloadHandler(mockNode as PeerNode);

        const req = createMock<Request>({ params: { hash: 'validh' } } as any);
        const res = createMock<Response>({});
        res.status = mock.fn(function() { return res; }) as any;
        res.json = mock.fn(function() { return res; }) as any;
        res.send = mock.fn(function() { return res; }) as any;

        await handler.handle(req as Request, res as Response);
        assert.strictEqual((res.status as import('node:test').Mock<any>).mock.calls[0]?.arguments[0], 401);
        assert.strictEqual((res.json as import('node:test').Mock<any>).mock.calls[0]?.arguments[0]?.message || (res.send as import('node:test').Mock<any>).mock.calls[0]?.arguments[0]?.message, 'Invalid block signature.');
    });

    it('Returns 401 on invalid decryption validation', async () => {
        const { publicKey, privateKey } = cryptoUtils.generateRSAKeyPair();
        
        const priv = { physicalId: 'pid', key: 'key', iv: 'iv', location: { type: 'local'}, files: [] };
        const encPriv = cryptoUtils.encryptPrivatePayload(publicKey, priv);
        const sig = cryptoUtils.signData(JSON.stringify(encPriv), privateKey);

        const mockCollection = createMock<Collection<Block>>({ find: mock.fn(() => ({ toArray: async () => [{ hash: 'validh', previousHash: '', publicKey, payload: encPriv, signature: sig, type: 'STORAGE_CONTRACT', metadata: { index: 0, timestamp: 0 } }] })) } as any);
        const mockNode: Partial<PeerNode> = { 
            publicKey, 
            privateKey: 'wrong_private_key_to_force_failure',
            ledger: { collection: mockCollection } as Ledger
        };
        const handler = new PrivatePayloadHandler(mockNode as PeerNode);

        const req = createMock<Request>({ params: { hash: 'validh' } } as any);
        const res = createMock<Response>({});
        res.status = mock.fn(function() { return res; }) as any;
        res.json = mock.fn(function() { return res; }) as any;
        res.send = mock.fn(function() { return res; }) as any;

        await handler.handle(req as Request, res as Response);
        assert.strictEqual((res.status as import('node:test').Mock<any>).mock.calls[0]?.arguments[0], 401);
        assert.strictEqual((res.json as import('node:test').Mock<any>).mock.calls[0]?.arguments[0]?.message || (res.send as import('node:test').Mock<any>).mock.calls[0]?.arguments[0]?.message, 'Failed to decrypt private payload.');
    });

    it('Returns HTTP 200 returning deeply nested raw unencrypted private structures', async () => {
        const { publicKey, privateKey } = cryptoUtils.generateRSAKeyPair();
        
        const priv = { physicalId: 'pid', key: 'key', iv: 'iv', location: { type: 'local' }, files: [] };
        const encPriv = cryptoUtils.encryptPrivatePayload(publicKey, priv);
        const sig = cryptoUtils.signData(JSON.stringify(encPriv), privateKey);

        const mockCollection = createMock<Collection<Block>>({ find: mock.fn(() => ({ toArray: async () => [{ hash: 'validh', previousHash: '', publicKey, payload: encPriv, signature: sig, type: 'STORAGE_CONTRACT', metadata: { index: 0, timestamp: 0 } }] })) } as any);
        const mockNode: Partial<PeerNode> = { 
            publicKey, 
            privateKey,
            ledger: { collection: mockCollection } as Ledger
        };
        const handler = new PrivatePayloadHandler(mockNode as PeerNode);

        const req = createMock<Request>({ params: { hash: 'validh' } } as any);
        const res = createMock<Response>({});
        res.status = mock.fn(function() { return res; }) as any;
        res.json = mock.fn(function() { return res; }) as any;
        res.send = mock.fn(function() { return res; }) as any;

        await handler.handle(req as Request, res as Response);
        assert.ok((res.json as import('node:test').Mock<any>).mock.calls[0]?.arguments[0]?.success);
        assert.strictEqual((res.json as import('node:test').Mock<any>).mock.calls[0]?.arguments[0]?.payload?.physicalId, 'pid');
    });
});
