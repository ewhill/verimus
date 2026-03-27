import assert from 'node:assert';
import { describe, it, mock } from 'node:test';

import * as cryptoUtils from '../../../crypto_utils/CryptoUtils';
import PrivatePayloadHandler from '../PrivatePayloadHandler';

function createRes() {
    const res: any = { statusCode: 200, body: null };
    res.status = (code: number) => { res.statusCode = code; return res; };
    res.json = (data: any) => { res.body = data; return res; };
    res.send = (data: any) => { res.body = data; return res; };
    return res;
}

describe('Backend: privatePayloadHandler Coverage', () => {

    it('Returns 404 for nonexistent block hash checking ledger and mempool', async () => {
        const mockNode: any = { ledger: { collection: { find: mock.fn(() => ({ toArray: async () => [] })) } }, mempool: { pendingBlocks: new Map() } };
        const handler = new PrivatePayloadHandler(mockNode);

        const req: any = { params: { hash: 'nonexistent' } };
        const res = createRes();

        await handler.handle(req, res);
        assert.strictEqual(res.statusCode, 404);
        assert.strictEqual(res.body?.success, false);
    });

    it('Returns 403 when public key mismatches authorization', async () => {
        const { publicKey: otherPubKey } = cryptoUtils.generateRSAKeyPair();
        const payload = cryptoUtils.encryptPrivatePayload(otherPubKey, { physicalId: 'pid', location: { type: 'local' }, aesKey: '', aesIv: '', files: [] });
        const _unusedMockBlock = { hash: 'exists', publicKey: otherPubKey };
        const mockNode: any = { publicKey: 'MY_KEY', ledger: { collection: { find: mock.fn(() => ({ toArray: async () => [{ hash: 'exists', previousHash: 'prev', publicKey: otherPubKey, signature: '', payload: payload, type: 'STORAGE_CONTRACT', metadata: { index: 0, timestamp: 0 } }] })) } } };
        const handler = new PrivatePayloadHandler(mockNode);

        const req: any = { params: { hash: ['exists'] } };
        const res = createRes();

        await handler.handle(req, res);
        assert.strictEqual(res.statusCode, 403);
    });

    it('Catches exceptions and returns 500 error mapping', async () => {
        const mockNode: any = { ledger: { collection: { find: mock.fn(() => { throw new Error('DB Error'); }) } } };
        const handler = new PrivatePayloadHandler(mockNode);

        const req: any = { params: { hash: 'exists' } };
        const res = createRes();

        await handler.handle(req, res);
        assert.strictEqual(res.statusCode, 500);
    });

    it('Gets block from mempool when missing in ledger', async () => {
        const { publicKey } = cryptoUtils.generateRSAKeyPair();
        const mockBlock = { hash: 'memhash', publicKey: publicKey, payload: cryptoUtils.encryptPrivatePayload(publicKey, { physicalId: 'pid', location: { type: 'local' }, aesKey: '', aesIv: '', files: [] }), signature: 'bad_sig', type: 'STORAGE_CONTRACT' as const, previousHash: 'prev', metadata: { index: -1, timestamp: 12345 } };
        const mockNode: any = { 
            publicKey, 
            ledger: { collection: { find: mock.fn(() => ({ toArray: async () => [] })) } },
            mempool: { pendingBlocks: new Map([['memhash', { block: mockBlock, committed: false, verifications: new Set(), eligible: true, originalTimestamp: 0 }]]) }
        };
        const handler = new PrivatePayloadHandler(mockNode);

        const req: any = { params: { hash: 'memhash' } };
        const res = createRes();

        await handler.handle(req, res);
        // It should reach signature verification and fail there, which gives 401, confirming it found the block in mempool
        assert.strictEqual(res.statusCode, 401);
    });

    it('Returns 401 when signature is invalid', async () => {
        const { publicKey, privateKey } = cryptoUtils.generateRSAKeyPair();
        const _unusedMockBlock = { hash: 'validh', publicKey: publicKey, payload: {}, signature: 'bad_sig' };
        const payload = cryptoUtils.encryptPrivatePayload(publicKey, { physicalId: 'pid', location: { type: 'local' }, aesKey: '', aesIv: '', files: [] });
        
        const mockNode: any = { 
            publicKey, 
            privateKey,
            ledger: { collection: { find: mock.fn(() => ({ toArray: async () => [{ hash: 'validh', previousHash: 'prev', publicKey: publicKey, payload: payload, signature: 'bad_sig', type: 'STORAGE_CONTRACT', metadata: { index: 0, timestamp: 0 } }] })) } }
        };
        const handler = new PrivatePayloadHandler(mockNode);

        const req: any = { params: { hash: 'validh' } };
        const res = createRes();

        await handler.handle(req, res);
        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(res.body?.message, 'Invalid block signature.');
    });

    it('Returns 401 on invalid decryption validation', async () => {
        const { publicKey, privateKey } = cryptoUtils.generateRSAKeyPair();
        
        const priv = { physicalId: 'pid', key: 'key', iv: 'iv', location: { type: 'local'}, files: [] };
        const encPriv = cryptoUtils.encryptPrivatePayload(publicKey, priv);
        const sig = cryptoUtils.signData(JSON.stringify(encPriv), privateKey);

        const mockNode: any = { 
            publicKey, 
            privateKey: 'wrong_private_key_to_force_failure',
            ledger: { collection: { find: mock.fn(() => ({ toArray: async () => [{ hash: 'validh', previousHash: '', publicKey, payload: encPriv, signature: sig, type: 'STORAGE_CONTRACT', metadata: { index: 0, timestamp: 0 } }] })) } }
        };
        const handler = new PrivatePayloadHandler(mockNode);

        const req: any = { params: { hash: 'validh' } };
        const res = createRes();

        await handler.handle(req, res);
        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(res.body?.message, 'Failed to decrypt private payload.');
    });

    it('Returns HTTP 200 returning deeply nested raw unencrypted private structures', async () => {
        const { publicKey, privateKey } = cryptoUtils.generateRSAKeyPair();
        
        const priv = { physicalId: 'pid', key: 'key', iv: 'iv', location: { type: 'local' }, files: [] };
        const encPriv = cryptoUtils.encryptPrivatePayload(publicKey, priv);
        const sig = cryptoUtils.signData(JSON.stringify(encPriv), privateKey);

        const mockNode: any = { 
            publicKey, 
            privateKey,
            ledger: { collection: { find: mock.fn(() => ({ toArray: async () => [{ hash: 'validh', previousHash: '', publicKey, payload: encPriv, signature: sig, type: 'STORAGE_CONTRACT', metadata: { index: 0, timestamp: 0 } }] })) } }
        };
        const handler = new PrivatePayloadHandler(mockNode);

        const req: any = { params: { hash: 'validh' } };
        const res = createRes();

        await handler.handle(req, res);
        assert.ok(res.body?.success);
        assert.strictEqual(res.body?.payload.physicalId, 'pid');
    });
});
