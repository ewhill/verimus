import assert from 'node:assert';
import { describe, it } from 'node:test';

import * as cryptoUtils from '../../../crypto_utils/CryptoUtils';
import { MockPeerNode } from '../../../test/mocks/MockPeerNode';
import { MockRequest } from '../../../test/mocks/MockRequest';
import { MockResponse } from '../../../test/mocks/MockResponse';
import PrivatePayloadHandler from '../PrivatePayloadHandler';

describe('Backend: privatePayloadHandler Coverage', () => {

    it('Returns 404 for nonexistent block hash checking ledger and mempool', async () => {
        const mockNode = new MockPeerNode();
        mockNode.ledger = { collection: { find: () => ({ toArray: async () => [] }) } };
        mockNode.mempool = { pendingBlocks: new Map() };
        const handler = new PrivatePayloadHandler(mockNode.asPeerNode());

        const req = new MockRequest({ params: { hash: 'nonexistent' } });
        const res = new MockResponse();

        await handler.handle(req.asRequest(), res.asResponse());
        assert.strictEqual(res.statusCode, 404);
        assert.strictEqual(res.body?.success, false);
    });

    it('Returns 403 when public key mismatches authorization', async () => {
        const mockBlock = { hash: 'exists', publicKey: 'OTHER_KEY' };
        const mockNode = new MockPeerNode({ publicKey: 'MY_KEY' });
        mockNode.ledger = { collection: { find: () => ({ toArray: async () => [mockBlock] }) } };
        const handler = new PrivatePayloadHandler(mockNode.asPeerNode());

        const req = new MockRequest({ params: { hash: ['exists'] } });
        const res = new MockResponse();

        await handler.handle(req.asRequest(), res.asResponse());
        assert.strictEqual(res.statusCode, 403);
    });

    it('Catches exceptions and returns 500 error mapping', async () => {
        const mockNode = new MockPeerNode();
        mockNode.ledger = { collection: { find: () => { throw new Error('DB Error'); } } };
        const handler = new PrivatePayloadHandler(mockNode.asPeerNode());

        const req = new MockRequest({ params: { hash: 'exists' } });
        const res = new MockResponse();

        await handler.handle(req.asRequest(), res.asResponse());
        assert.strictEqual(res.statusCode, 500);
    });

    it('Gets block from mempool when missing in ledger', async () => {
        const { publicKey, privateKey } = cryptoUtils.generateRSAKeyPair();
        const mockBlock = { hash: 'memhash', publicKey: publicKey, payload: {}, signature: 'bad_sig' };
        const mockNode = new MockPeerNode({ publicKey });
        mockNode.ledger = { collection: { find: () => ({ toArray: async () => [] }) } };
        mockNode.mempool = { pendingBlocks: new Map([['memhash', { block: mockBlock }]]) };
        const handler = new PrivatePayloadHandler(mockNode.asPeerNode());

        const req = new MockRequest({ params: { hash: 'memhash' } });
        const res = new MockResponse();

        await handler.handle(req.asRequest(), res.asResponse());
        // It should reach signature verification and fail there, which gives 401, confirming it found the block in mempool
        assert.strictEqual(res.statusCode, 401);
    });

    it('Returns 401 when signature is invalid', async () => {
        const { publicKey, privateKey } = cryptoUtils.generateRSAKeyPair();
        const mockBlock = { hash: 'validh', publicKey: publicKey, payload: {}, signature: 'bad_sig' };
        
        const mockNode = new MockPeerNode({ publicKey, privateKey });
        mockNode.ledger = { collection: { find: () => ({ toArray: async () => [mockBlock] }) } };
        const handler = new PrivatePayloadHandler(mockNode.asPeerNode());

        const req = new MockRequest({ params: { hash: 'validh' } });
        const res = new MockResponse();

        await handler.handle(req.asRequest(), res.asResponse());
        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(res.body?.message, 'Invalid block signature.');
    });

    it('Returns 401 on invalid decryption validation', async () => {
        const { publicKey, privateKey } = cryptoUtils.generateRSAKeyPair();
        
        const priv = { physicalId: 'pid', key: 'key', iv: 'iv', location: { type: 'local'}, files: [] };
        const encPriv = cryptoUtils.encryptPrivatePayload(publicKey, priv);
        const sig = cryptoUtils.signData(JSON.stringify(encPriv), privateKey);

        const mockNode = new MockPeerNode({ publicKey, privateKey: 'wrong_private_key_to_force_failure' });
        mockNode.ledger = { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', publicKey, payload: encPriv, signature: sig }] }) } };
        const handler = new PrivatePayloadHandler(mockNode.asPeerNode());

        const req = new MockRequest({ params: { hash: 'validh' } });
        const res = new MockResponse();

        await handler.handle(req.asRequest(), res.asResponse());
        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(res.body?.message, 'Failed to decrypt private payload.');
    });

    it('Returns HTTP 200 returning deeply nested raw unencrypted private structures', async () => {
        const { publicKey, privateKey } = cryptoUtils.generateRSAKeyPair();
        
        const priv = { physicalId: 'pid', key: 'key', iv: 'iv', location: { type: 'local' }, files: [] };
        const encPriv = cryptoUtils.encryptPrivatePayload(publicKey, priv);
        const sig = cryptoUtils.signData(JSON.stringify(encPriv), privateKey);

        const mockNode = new MockPeerNode({ publicKey, privateKey });
        mockNode.ledger = { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', publicKey, payload: encPriv, signature: sig }] }) } };
        const handler = new PrivatePayloadHandler(mockNode.asPeerNode());

        const req = new MockRequest({ params: { hash: 'validh' } });
        const res = new MockResponse();

        await handler.handle(req.asRequest(), res.asResponse());
        assert.ok(res.body?.success);
        assert.strictEqual(res.body?.payload.physicalId, 'pid');
    });
});
