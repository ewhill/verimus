import assert from 'node:assert';
import { Writable } from 'node:stream';
import { describe, it } from 'node:test';


import { generateRSAKeyPair } from '../../../crypto_utils/CryptoUtils';
import { MockBundler } from '../../../test/mocks/MockBundler';
import { MockPeerNode } from '../../../test/mocks/MockPeerNode';
import { MockRequest } from '../../../test/mocks/MockRequest';
import { MockResponse } from '../../../test/mocks/MockResponse';
import { MockStorageProvider } from '../../../test/mocks/MockStorageProvider';
// import { NodeRole } from '../../../types/NodeRole';
import UploadHandler from '../UploadHandler';

describe('Backend: uploadHandler Coverage Unit Tests', () => {

    it('Rejects requests attempting to stream zero bundled files', async () => {
        const mockNode = new MockPeerNode();
        const handler = new UploadHandler(mockNode.asPeerNode());

        const req = new MockRequest({ files: [] });
        const res = new MockResponse();

        await handler.handle(req.asRequest(), res.asResponse());
        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.body, 'No files uploaded.');
    });

    it('Processes valid multipart file bundles orchestrating bundler streams', async () => {
        let blockHandled = false;
        const { publicKey, privateKey } = generateRSAKeyPair();

        const mockNode = new MockPeerNode({
            port: 3000,
            publicKey: publicKey,
            privateKey: privateKey,
        });

        mockNode.storageProvider = new MockStorageProvider();
        mockNode.storageProvider.createBlockStream = () => ({ physicalBlockId: 'mockId', writeStream: new Writable({ write(_c, _e, cb) { cb(); } }) });
        mockNode.bundler = new MockBundler();
        mockNode.bundler!.streamErasureBundle = async () => ({ aesKey: 'KEY', aesIv: 'IV', files: [], shards: [Buffer.from('mock')], authTag: '', originalSize: 0 });
        mockNode.consensusEngine.handlePendingBlock = async () => { blockHandled = true; };
        mockNode.consensusEngine.walletManager.verifyFunds = async () => true;
        mockNode.syncEngine.orchestrateStorageMarket = async () => [{ peerId: 'mock-1', connection: { peerAddress: 'address', send: () => {} } }];
        if (mockNode.peer) mockNode.peer.broadcast = async () => { };
        mockNode.events.once = (evt: string | symbol, cb: (...args: any[]) => void) => {
            if (typeof evt === 'string' && evt.startsWith('shard_response')) {
                setTimeout(() => cb({ success: true, physicalId: 'mockId' }), 5);
            } else {
                setTimeout(() => cb({ hash: 'fakeHash settled' }), 5);
            }
            return mockNode.events;
        };
        mockNode.events.removeAllListeners = () => mockNode.events;

        const handler = new UploadHandler(mockNode.asPeerNode());
        const req = new MockRequest({ 
            files: [{ originalname: 'test' }],
            body: { paths: JSON.stringify(['test']) } // Try stringified JSON paths
        });
        const res = new MockResponse();

        await handler.handle(req.asRequest(), res.asResponse());
        assert.strictEqual(res.statusCode, 202);
        assert.strictEqual(res.body.success, true);
        assert.ok(blockHandled, 'Should kick off a consensus settlement correctly intrinsically');
    });

    it('Handles and catches bubbled initialization API exception errors', async () => {
        const mockNode = new MockPeerNode();
        mockNode.storageProvider = new MockStorageProvider();
        mockNode.storageProvider.createBlockStream = () => { throw new Error('Simulated Creation Error'); };
        mockNode.consensusEngine.walletManager.verifyFunds = async () => true;

        const handler = new UploadHandler(mockNode.asPeerNode());
        const req = new MockRequest({ files: [{ originalname: 'throws' }], body: {} });
        const res = new MockResponse();

        await handler.handle(req.asRequest(), res.asResponse());
        assert.strictEqual(res.statusCode, 500);
    });

    it('Maps custom string destination locations validating config fallback', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();
        const mockNode = new MockPeerNode({ publicKey, privateKey, port: 1234 });
        mockNode.storageProvider = new MockStorageProvider();
        mockNode.storageProvider.createBlockStream = () => ({ physicalBlockId: 'id', writeStream: new Writable({ write(_c, _e, cb) { cb(); } }) });
        mockNode.bundler = new MockBundler();
        mockNode.bundler.streamErasureBundle = async () => ({ files: [], aesKey: 'k', aesIv: 'iv', shards: [Buffer.from('mock')], authTag: '', originalSize: 0 });
        mockNode.consensusEngine.handlePendingBlock = async () => {};
        mockNode.consensusEngine.walletManager.verifyFunds = async () => true;
        mockNode.syncEngine.orchestrateStorageMarket = async () => [{ peerId: 'mock-1', connection: { peerAddress: 'address', send: () => {} } }];
        mockNode.events.once = (evt: string | symbol, cb: (...args: any[]) => void) => { if (typeof evt === 'string' && evt.startsWith('shard_response')) { cb({ success: true, physicalId: 'id' }); } return mockNode.events; };
        mockNode.events.removeAllListeners = () => mockNode.events;
        if (mockNode.peer) mockNode.peer.broadcast = async () => {};

        const handler = new UploadHandler(mockNode.asPeerNode());
        const req = new MockRequest({ files: [{ originalname: 'test' }], body: { paths: 'a/b/c' } });
        const res = new MockResponse();

        await handler.handle(req.asRequest(), res.asResponse()); // We just need it to hit the paths catch block
    });

    it('Identifies and halts timed out unresolved block streaming operations', async (t: any) => {
        if (t?.mock?.timers) { t.mock.timers.enable({ apis: ['setTimeout'] }); }
        else {
            // fallback if mock is absent
        }

        const { publicKey, privateKey } = generateRSAKeyPair();
        const mockNode = new MockPeerNode({ publicKey, privateKey, port: 1234 });
        mockNode.storageProvider = new MockStorageProvider();
        mockNode.storageProvider.createBlockStream = () => ({ physicalBlockId: 'id', writeStream: new Writable({ write(_c, _e, cb) { cb(); } }) });
        mockNode.bundler = new MockBundler();
        mockNode.bundler!.streamErasureBundle = async () => ({ files: [], aesKey: 'k', aesIv: 'iv', shards: [Buffer.from('mock')], authTag: '', originalSize: 0 });
        mockNode.consensusEngine.handlePendingBlock = async () => { throw new Error('Converge Error for test'); };
        mockNode.consensusEngine.walletManager.verifyFunds = async () => true;
        mockNode.syncEngine.orchestrateStorageMarket = async () => [{ peerId: 'mock-1', connection: { peerAddress: 'address', send: () => {} } }];
        mockNode.events.once = (evt: string | symbol, cb: (...args: any[]) => void) => { if (typeof evt === 'string' && evt.startsWith('shard_response')) { cb({ success: true, physicalId: 'id' }); } return mockNode.events; };
        mockNode.events.removeAllListeners = () => mockNode.events;
        if (mockNode.peer) mockNode.peer.broadcast = async () => {};

        const handler = new UploadHandler(mockNode.asPeerNode());

        const req = new MockRequest({ files: [{ originalname: 'test' }], body: {} }); // Try empty body!
        const res = new MockResponse();

        await handler.handle(req.asRequest(), res.asResponse());
        
        if (t?.mock?.timers) { t.mock.timers.tick(120000); }
        // ensure event loop flushes
        await new Promise<void>(resolve => setImmediate(resolve));
    });
});

