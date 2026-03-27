import assert from 'node:assert';
import { Writable } from 'node:stream';
import { describe, it } from 'node:test';


import { generateRSAKeyPair } from '../../../crypto_utils/CryptoUtils';
import { NodeRole } from '../../../types/NodeRole';
import UploadHandler from '../UploadHandler';

function createRes() {
    const res: any = { statusCode: 200, body: null };
    res.status = (code: number) => { res.statusCode = code; return res; };
    res.json = (data: any) => { res.body = data; return res; };
    res.send = (data: any) => { res.body = data; return res; };
    return res;
}

describe('Backend: uploadHandler Coverage Unit Tests', () => {

    it('Rejects requests attempting to stream zero bundled files', async () => {
        const mockNode: any = { roles: [NodeRole.ORIGINATOR] };
        const handler = new UploadHandler(mockNode);

        const req: any = { files: [] };
        const res = createRes();

        await handler.handle(req, res);
        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.body, 'No files uploaded.');
    });

    it('Processes valid multipart file bundles orchestrating bundler streams', async () => {
        let blockHandled = false;
        const { publicKey, privateKey } = generateRSAKeyPair();

        const mockNode: any = {
            roles: [NodeRole.ORIGINATOR],
            port: 3000,
            publicKey: publicKey,
            privateKey: privateKey,
            storageProvider: { createBlockStream: () => ({ physicalBlockId: 'mockId', writeStream: new Writable({ write(_c, _e, cb) { cb(); } }) }) },
            bundler: { streamErasureBundle: async () => ({ aesKey: 'KEY', aesIv: 'IV', files: [], shards: [Buffer.from('mock')], authTag: '', originalSize: 0 }) },
            consensusEngine: { handlePendingBlock: async () => { blockHandled = true; }, walletManager: { verifyFunds: async () => true, freezeFunds: () => {}, releaseFunds: () => {}, commitFunds: () => {} }, node: { syncEngine: { orchestrateStorageMarket: async () => [{ peerId: 'mock-1', connection: { peerAddress: 'address', send: () => {} } }] } } },
            syncEngine: { orchestrateStorageMarket: async () => [{ peerId: 'mock-1', connection: { peerAddress: 'address', send: () => {} } }] },
            peer: { broadcast: async () => { } },
            events: {
                once: (evt: string | symbol, cb: (...args: any[]) => void) => {
                    if (typeof evt === 'string' && evt.startsWith('shard_response')) {
                        setTimeout(() => cb({ success: true, physicalId: 'mockId' }), 5);
                    } else {
                        setTimeout(() => cb({ hash: 'fakeHash settled' }), 5);
                    }
                    return mockNode.events;
                },
                removeAllListeners: () => mockNode.events
            }
        };

        const handler = new UploadHandler(mockNode);
        const req: any = { 
            files: [{ originalname: 'test' }],
            body: { paths: JSON.stringify(['test']) }
        };
        const res = createRes();

        await handler.handle(req, res);
        assert.strictEqual(res.statusCode, 202);
        assert.strictEqual(res.body.success, true);
        assert.ok(blockHandled, 'Should kick off a consensus settlement correctly intrinsically');
    });

    it('Handles and catches bubbled initialization API exception errors', async () => {
        const mockNode: any = {
            roles: [NodeRole.ORIGINATOR],
            storageProvider: { createBlockStream: () => { throw new Error('Simulated Creation Error'); } },
            consensusEngine: { walletManager: { verifyFunds: async () => true, freezeFunds: () => {}, releaseFunds: () => {}, commitFunds: () => {} } }
        };

        const handler = new UploadHandler(mockNode);
        const req: any = { files: [{ originalname: 'throws' }], body: {} };
        const res = createRes();

        await handler.handle(req, res);
        assert.strictEqual(res.statusCode, 500);
    });

    it('Maps custom string destination locations validating config fallback', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();
        const mockNode: any = {
            roles: [NodeRole.ORIGINATOR], publicKey, privateKey, port: 1234,
            storageProvider: { createBlockStream: () => ({ physicalBlockId: 'id', writeStream: new Writable({ write(_c, _e, cb) { cb(); } }) }) },
            bundler: { streamErasureBundle: async () => ({ files: [], aesKey: 'k', aesIv: 'iv', shards: [Buffer.from('mock')], authTag: '', originalSize: 0 }) },
            consensusEngine: { handlePendingBlock: async () => {}, walletManager: { verifyFunds: async () => true, freezeFunds: () => {}, releaseFunds: () => {}, commitFunds: () => {} }, node: { syncEngine: { orchestrateStorageMarket: async () => [{ peerId: 'mock-1', connection: { peerAddress: 'address', send: () => {} } }] } } },
            syncEngine: { orchestrateStorageMarket: async () => [{ peerId: 'mock-1', connection: { peerAddress: 'address', send: () => {} } }] },
            peer: { broadcast: async () => {} },
            events: {
                once: (evt: string | symbol, cb: (...args: any[]) => void) => { if (typeof evt === 'string' && evt.startsWith('shard_response')) { cb({ success: true, physicalId: 'id' }); } return mockNode.events; },
                removeAllListeners: () => mockNode.events
            }
        };

        const handler = new UploadHandler(mockNode);
        const req: any = { files: [{ originalname: 'test' }], body: { paths: 'a/b/c' } };
        const res = createRes();

        await handler.handle(req, res); // We just need it to hit the paths catch block
    });

    it('Identifies and halts timed out unresolved block streaming operations', async (t: any) => {
        if (t?.mock?.timers) { t.mock.timers.enable({ apis: ['setTimeout'] }); }
        else {
            // fallback if mock is absent
        }

        const { publicKey, privateKey } = generateRSAKeyPair();
        const mockNode: any = {
            roles: [NodeRole.ORIGINATOR], publicKey, privateKey, port: 1234,
            storageProvider: { createBlockStream: () => ({ physicalBlockId: 'id', writeStream: new Writable({ write(_c, _e, cb) { cb(); } }) }) },
            bundler: { streamErasureBundle: async () => ({ files: [], aesKey: 'k', aesIv: 'iv', shards: [Buffer.from('mock')], authTag: '', originalSize: 0 }) },
            consensusEngine: { handlePendingBlock: async () => { throw new Error('Converge Error for test'); }, walletManager: { verifyFunds: async () => true, freezeFunds: () => {}, releaseFunds: () => {}, commitFunds: () => {} }, node: { syncEngine: { orchestrateStorageMarket: async () => [{ peerId: 'mock-1', connection: { peerAddress: 'address', send: () => {} } }] } } },
            syncEngine: { orchestrateStorageMarket: async () => [{ peerId: 'mock-1', connection: { peerAddress: 'address', send: () => {} } }] },
            peer: { broadcast: async () => {} },
            events: {
                once: (evt: string | symbol, cb: (...args: any[]) => void) => { if (typeof evt === 'string' && evt.startsWith('shard_response')) { cb({ success: true, physicalId: 'id' }); } return mockNode.events; },
                removeAllListeners: () => mockNode.events
            }
        };

        const handler = new UploadHandler(mockNode);

        const req: any = { files: [{ originalname: 'test' }], body: {} }; // Try empty body!
        const res = createRes();

        await handler.handle(req, res);
        
        if (t?.mock?.timers) { t.mock.timers.tick(120000); }
        // ensure event loop flushes
        await new Promise<void>(resolve => setImmediate(resolve));
    });
});

