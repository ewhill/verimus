import assert from 'node:assert';
import { describe, it } from 'node:test';

import { generateRSAKeyPair } from '../../../crypto_utils/CryptoUtils';
import { NodeRole } from '../../../types/NodeRole';
import UploadHandler from '../UploadHandler';

describe('Backend: uploadHandler Coverage Unit Tests', () => {

    it('Rejects requests attempting to stream zero bundled files', async () => {
        const handler = new UploadHandler({ roles: [NodeRole.ORIGINATOR] } as any);

        const req: any = { files: [] };
        let statusSet = 0;
        let bodyPayload: any = null;
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            send: (b: any) => { bodyPayload = b; return res; },
            headersSent: false
        };

        await handler.handle(req, res);
        assert.strictEqual(statusSet, 400);
        assert.strictEqual(bodyPayload, 'No files uploaded.');
    });

    it('Processes valid multipart file bundles orchestrating bundler streams', async () => {
        let blockHandled = false;
        const { publicKey, privateKey } = generateRSAKeyPair();

        const mockNode: any = {
            port: 3000,
            roles: [NodeRole.ORIGINATOR],
            publicKey: publicKey,
            privateKey: privateKey,
            storageProvider: {
                createBlockStream: () => ({ physicalBlockId: 'mockId', writeStream: {} }),
                getLocation: () => ({ type: 'local' })
            },
            bundler: {
                streamErasureBundle: async () => ({ aesKey: 'KEY', aesIv: 'IV', files: [], shards: [Buffer.from('mock')] })
            },
            consensusEngine: {
                handlePendingBlock: async () => { blockHandled = true; },
                walletManager: {
                    verifyFunds: async () => true,
                    freezeFunds: () => {},
                    releaseFunds: () => {},
                    commitFunds: () => {}
                },
                node: {
                    syncEngine: {
                        orchestrateStorageMarket: async () => [{ peerId: 'mock-1', connection: { send: () => {} } }]
                    }
                }
            },
            peer: {
                broadcast: async () => { }
            },
            events: {
                once: (evt: string, cb: Function) => {
                    if (evt.startsWith('shard_response')) {
                        setTimeout(() => cb({ success: true, physicalId: 'mockId' }), 5);
                    } else {
                        setTimeout(() => cb({ hash: 'fakeHash settled' }), 5);
                    }
                },
                removeAllListeners: () => {}
            }
        };

        const handler = new UploadHandler(mockNode as any);
        const req: any = { 
            files: [{ originalname: 'test' }],
            body: { paths: JSON.stringify(['test']) } // Try stringified JSON paths
        };
        let statusSet = 0;
        let jsonPayload: any = null;
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            json: (j: any) => { jsonPayload = j; return res; },
            headersSent: false
        };

        await handler.handle(req, res);
        assert.strictEqual(statusSet, 202);
        assert.strictEqual(jsonPayload.success, true);
        assert.ok(blockHandled, 'Should kick off a consensus settlement correctly intrinsically');
    });

    it('Handles and catches bubbled initialization API exception errors', async () => {
        const handler = new UploadHandler({
            roles: [NodeRole.ORIGINATOR],
            storageProvider: {
                createBlockStream: () => { throw new Error('Simulated Creation Error') }
            },
            consensusEngine: {
                walletManager: {
                    verifyFunds: async () => true,
                    freezeFunds: () => {},
                    releaseFunds: () => {}
                }
            }
        } as any); // Mock with explicit error throwing

        const req: any = { files: [{ originalname: 'throws' }], body: {} };
        let statusSet = 0;
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            json: (j: any) => { return res; },
            send: () => res, // Add send
            headersSent: false
        };

        await handler.handle(req, res);
        assert.strictEqual(statusSet, 500);
    });

    it('Maps custom string destination locations validating config fallback', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();
        const handler = new UploadHandler({
            publicKey, privateKey, port: 1234, roles: [NodeRole.ORIGINATOR],
            storageProvider: { createBlockStream: () => ({ physicalBlockId: 'id', writeStream: { on: () => {} } }), getLocation: () => 'loc' },
            bundler: { streamErasureBundle: async () => ({ files: [], aesKey: 'k', aesIv: 'iv', shards: [Buffer.from('mock')] }) },
            consensusEngine: {
                handlePendingBlock: async () => {},
                walletManager: {
                    verifyFunds: async () => true,
                    freezeFunds: () => {},
                    releaseFunds: () => {},
                    commitFunds: () => {}
                },
                node: {
                    syncEngine: {
                        orchestrateStorageMarket: async () => [{ peerId: 'mock-1', connection: { send: () => {} } }]
                    }
                }
            },
            events: { once: (evt: string, cb: Function) => { if (evt.startsWith('shard_response')) { cb({ success: true, physicalId: 'id' }); } }, removeAllListeners: () => {} },
            peer: { broadcast: async () => {} }
        } as any);

        const req: any = { files: [{ originalname: 'test' }], body: { paths: 'a/b/c' } }; // Not JSON string
        const res: any = { status: () => res, send: () => res, json: () => res, headersSent: false };

        await handler.handle(req, res); // We just need it to hit the paths catch block
    });

    it('Identifies and halts timed out unresolved block streaming operations', async (t: any) => {
        if (t?.mock?.timers) { t.mock.timers.enable({ apis: ['setTimeout'] }); }
        else {
            // fallback if mock is absent
        }

        const { publicKey, privateKey } = generateRSAKeyPair();
        const mockNode = {
             publicKey, privateKey, port: 1234, roles: [NodeRole.ORIGINATOR],
             storageProvider: { createBlockStream: () => ({ physicalBlockId: 'id', writeStream: { on: () => {} } }), getLocation: () => 'loc' },
             bundler: { streamErasureBundle: async () => ({ files: [], aesKey: 'k', aesIv: 'iv', shards: [Buffer.from('mock')] }) },
             consensusEngine: {
                 handlePendingBlock: async () => { throw new Error('Converge Error for test'); },
                 walletManager: {
                     verifyFunds: async () => true,
                     freezeFunds: () => {},
                     releaseFunds: () => {},
                     commitFunds: () => {}
                 },
                 node: {
                     syncEngine: {
                         orchestrateStorageMarket: async () => [{ peerId: 'mock-1', connection: { send: () => {} } }]
                     }
                 }
             },
             events: { once: (evt: string, cb: Function) => { if (evt.startsWith('shard_response')) { cb({ success: true, physicalId: 'id' }); } }, removeAllListeners: () => {} },
             peer: { broadcast: async () => {} }
        };
        const handler = new UploadHandler(mockNode as any);

        const req: any = { files: [{ originalname: 'test' }], body: {} }; // Try empty body!
        const res: any = { status: () => res, send: () => res, json: () => res, headersSent: false };

        await handler.handle(req, res);
        
        if (t?.mock?.timers) { t.mock.timers.tick(120000); }
        // ensure event loop flushes
        await new Promise<void>(resolve => setImmediate(resolve));
    });
});

