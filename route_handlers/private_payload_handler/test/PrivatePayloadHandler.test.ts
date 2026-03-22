import { describe, it } from 'node:test';
import assert from 'node:assert';
import PrivatePayloadHandler from '../PrivatePayloadHandler';
import * as cryptoUtils from '../../../crypto_utils/CryptoUtils';

describe('Backend: privatePayloadHandler Coverage', () => {

    it('Returns 404 for nonexistent block hash checking ledger and mempool', async () => {
        const handler = new PrivatePayloadHandler({ 
            ledger: { collection: { find: () => ({ toArray: async () => [] }) } },
            mempool: { pendingBlocks: new Map() }
        } as any);

        const req: any = { params: { hash: 'nonexistent' } };
        let statusSet = 0;
        let jsonPayload: any = null;
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            json: (j: any) => { jsonPayload = j; return res; },
            headersSent: false
        };

        await handler.handle(req, res);
        assert.strictEqual(statusSet, 404);
        assert.strictEqual(jsonPayload.success, false);
    });

    it('Returns 403 when public key mismatches authorization', async () => {
        const mockBlock = { hash: 'exists', publicKey: 'OTHER_KEY' };
        const handler = new PrivatePayloadHandler({ 
            publicKey: 'MY_KEY',
            ledger: { collection: { find: () => ({ toArray: async () => [mockBlock] }) } }
        } as any);

        const req: any = { params: { hash: ['exists'] } };
        let statusSet = 0;
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            json: (j: any) => { return res; },
            headersSent: false
        };

        await handler.handle(req, res);
        assert.strictEqual(statusSet, 403);
    });

    it('Catches exceptions and returns 500 error mapping', async () => {
        const handler = new PrivatePayloadHandler({ 
            ledger: { collection: { find: () => { throw new Error('DB Error'); } } }
        } as any);

        const req: any = { params: { hash: 'exists' } };
        let statusSet = 0;
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            json: (j: any) => { return res; },
            headersSent: false
        };

        await handler.handle(req, res);
        assert.strictEqual(statusSet, 500);
    });

    it('Gets block from mempool when missing in ledger', async () => {
        const { publicKey, privateKey } = cryptoUtils.generateRSAKeyPair();
        const mockBlock = { hash: 'memhash', publicKey: publicKey, private: {}, signature: 'bad_sig' };
        const handler = new PrivatePayloadHandler({ 
            publicKey: publicKey,
            ledger: { collection: { find: () => ({ toArray: async () => [] }) } },
            mempool: { pendingBlocks: new Map([['memhash', { block: mockBlock }]]) }
        } as any);

        const req: any = { params: { hash: 'memhash' } };
        let statusSet = 0;
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            json: (j: any) => { return res; },
            headersSent: false
        };

        await handler.handle(req, res);
        // It should reach signature verification and fail there, which gives 401, confirming it found the block in mempool
        assert.strictEqual(statusSet, 401);
    });

    it('Returns 401 when signature is invalid', async () => {
        const { publicKey, privateKey } = cryptoUtils.generateRSAKeyPair();
        const mockBlock = { hash: 'validh', publicKey: publicKey, private: {}, signature: 'bad_sig' };
        
        const handler = new PrivatePayloadHandler({ 
            publicKey: publicKey,
            privateKey: privateKey,
            ledger: { collection: { find: () => ({ toArray: async () => [mockBlock] }) } }
        } as any);

        const req: any = { params: { hash: 'validh' } };
        let statusSet = 0;
        let jsonRes: any = null;
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            json: (j: any) => { jsonRes = j; return res; },
            headersSent: false
        };

        await handler.handle(req, res);
        assert.strictEqual(statusSet, 401);
        assert.strictEqual(jsonRes.message, 'Invalid block signature.');
    });

    it('Returns HTTP 401 handling invalid decryption validation automatically', async () => {
        const { publicKey, privateKey } = cryptoUtils.generateRSAKeyPair();
        
        const priv = { physicalId: 'pid', key: 'key', iv: 'iv', location: { type: 'local'}, files: [] };
        const encPriv = cryptoUtils.encryptPrivatePayload(publicKey, priv);
        const sig = cryptoUtils.signData(JSON.stringify(encPriv), privateKey);

        const handler = new PrivatePayloadHandler({ 
            publicKey: publicKey,
            privateKey: 'wrong_private_key_to_force_failure',
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', publicKey, private: encPriv, signature: sig }] }) } }
        } as any);

        const req: any = { params: { hash: 'validh' } };
        let statusSet = 0;
        let jsonRes: any = null;
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            json: (j: any) => { jsonRes = j; return res; },
            headersSent: false
        };

        await handler.handle(req, res);
        assert.strictEqual(statusSet, 401);
        assert.strictEqual(jsonRes.message, 'Failed to decrypt private payload.');
    });

    it('Returns HTTP 200 returning deeply nested raw unencrypted private structures', async () => {
        const { publicKey, privateKey } = cryptoUtils.generateRSAKeyPair();
        
        const priv = { physicalId: 'pid', key: 'key', iv: 'iv', location: { type: 'local' }, files: [] };
        const encPriv = cryptoUtils.encryptPrivatePayload(publicKey, priv);
        const sig = cryptoUtils.signData(JSON.stringify(encPriv), privateKey);

        const handler = new PrivatePayloadHandler({ 
            publicKey: publicKey,
            privateKey: privateKey,
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', publicKey, private: encPriv, signature: sig }] }) } }
        } as any);

        const req: any = { params: { hash: 'validh' } };
        let jsonRes: any = null;
        const res: any = {
            json: (j: any) => { jsonRes = j; return res; },
            headersSent: false
        };

        await handler.handle(req, res);
        assert.ok(jsonRes.success);
        assert.strictEqual(jsonRes.payload.physicalId, 'pid');
    });
});
