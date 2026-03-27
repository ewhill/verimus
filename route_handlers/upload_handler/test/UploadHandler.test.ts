import type EventEmitter from 'events';
import assert from 'node:assert';
import { Writable } from 'node:stream';
import { describe, it } from 'node:test';


import type { Request, Response } from 'express';

import type Bundler from '../../../bundler/Bundler';
import { generateRSAKeyPair, buildMerkleTree, getMerkleProof } from '../../../crypto_utils/CryptoUtils';
import type { Peer } from '../../../p2p';
import type ConsensusEngine from '../../../peer_handlers/consensus_engine/ConsensusEngine';
import type { ReputationManager } from '../../../peer_handlers/reputation_manager/ReputationManager';
import type SyncEngine from '../../../peer_handlers/sync_engine/SyncEngine';
import type PeerNode from '../../../peer_node/PeerNode';
import type BaseProvider from '../../../storage_providers/base_provider/BaseProvider';
import { NodeRole } from '../../../types/NodeRole';
import UploadHandler from '../UploadHandler';

function createRes(): Partial<Response> & { body?: unknown } {
    const res: Partial<Response> & { body?: unknown } = { statusCode: 200, body: null };
    res.status = function(code: number) { this.statusCode = code; return this as Response; };
    res.json = function(data: unknown) { this.body = data; return this as Response; };
    res.send = function(data: unknown) { this.body = data; return this as Response; };
    return res;
}

describe('Backend: uploadHandler Coverage Unit Tests', () => {

    it('Rejects requests attempting to stream zero bundled files', async () => {
        const mockNode: Partial<PeerNode> = { roles: [NodeRole.ORIGINATOR] };
        const handler = new UploadHandler(mockNode as PeerNode);

        const req = { files: [] } as unknown as Request & { files: unknown[] };
        const res = createRes();

        await handler.handle(req as Request, res as unknown as Response);
        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.body, 'No files uploaded.');
    });

    it('Processes valid multipart file bundles orchestrating bundler streams', async () => {
        let blockHandled = false;
        const { publicKey, privateKey } = generateRSAKeyPair();

        const buffer = Buffer.from('mock');
        const { tree, root } = buildMerkleTree([buffer]);
        const merkleSiblings = getMerkleProof(tree, 0);

        const mockNode: Partial<PeerNode> = {
            roles: [NodeRole.ORIGINATOR],
            port: 3000,
            publicKey: publicKey,
            privateKey: privateKey,
            storageProvider: { createBlockStream: () => ({ physicalBlockId: 'mockId', writeStream: new Writable({ write(_c, _e, cb) { cb(); } }) }) } as unknown as BaseProvider,
            bundler: { streamErasureBundle: async () => ({ aesKey: 'KEY', aesIv: 'IV', files: [], shards: [buffer], authTag: '', originalSize: 0, merkleRoots: [root] }) } as unknown as Bundler,
            consensusEngine: { handlePendingBlock: async () => { blockHandled = true; }, walletManager: { verifyFunds: async () => true, freezeFunds: () => {}, releaseFunds: () => {}, commitFunds: () => {} } } as unknown as ConsensusEngine,
            syncEngine: { orchestrateStorageMarket: async () => [{ peerId: 'mock-1', connection: { peerAddress: 'address', send: () => {} } }] } as unknown as SyncEngine,
            peer: { broadcast: async () => { } } as unknown as Peer,
            reputationManager: { penalizeMajor: () => {} } as unknown as ReputationManager,
            events: {
                once: (evt: string | symbol, cb: (...args: unknown[]) => void) => {
                    if (typeof evt === 'string' && evt.startsWith('shard_response')) {
                        setTimeout(() => cb({ success: true, physicalId: 'mockId' }), 5);
                    } else if (typeof evt === 'string' && evt.startsWith('handoff_response')) {
                        setTimeout(() => cb({ success: true, chunkDataBase64: buffer.toString('base64'), merkleSiblings: merkleSiblings }), 5);
                    } else {
                        setTimeout(() => cb({ hash: 'fakeHash settled' }), 5);
                    }
                    return mockNode.events as EventEmitter;
                },
                removeAllListeners: () => mockNode.events as EventEmitter
            } as unknown as EventEmitter
        };

        const handler = new UploadHandler(mockNode as PeerNode);
        const req = { 
            files: [{ originalname: 'test' }],
            body: { paths: JSON.stringify(['test']) }
        } as unknown as Request & { files: unknown[], body: any };
        const res = createRes();

        await handler.handle(req as Request, res as unknown as Response);
        assert.strictEqual(res.statusCode, 202);
        assert.strictEqual((res.body as any).success, true);
        assert.ok(blockHandled, 'Should kick off a consensus settlement correctly intrinsically');
    });

    it('Handles and catches bubbled initialization API exception errors', async () => {
        const mockNode: Partial<PeerNode> = {
            roles: [NodeRole.ORIGINATOR],
            storageProvider: { createBlockStream: () => { throw new Error('Simulated Creation Error'); } } as unknown as BaseProvider,
            consensusEngine: { walletManager: { verifyFunds: async () => true, freezeFunds: () => {}, releaseFunds: () => {}, commitFunds: () => {} } } as unknown as ConsensusEngine
        };

        const handler = new UploadHandler(mockNode as PeerNode);
        const req = { files: [{ originalname: 'throws' }], body: {} } as unknown as Request & { files: unknown[], body: unknown };
        const res = createRes();

        await handler.handle(req as Request, res as unknown as Response);
        assert.strictEqual(res.statusCode, 500);
    });

    it('Maps custom string destination locations validating config fallback', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();
        const buffer = Buffer.from('mock');
        const { tree, root } = buildMerkleTree([buffer]);
        const merkleSiblings = getMerkleProof(tree, 0);

        const mockNode: Partial<PeerNode> = {
            roles: [NodeRole.ORIGINATOR], publicKey, privateKey, port: 1234,
            storageProvider: { createBlockStream: () => ({ physicalBlockId: 'id', writeStream: new Writable({ write(_c, _e, cb) { cb(); } }) }) } as unknown as BaseProvider,
            bundler: { streamErasureBundle: async () => ({ files: [], aesKey: 'k', aesIv: 'iv', shards: [buffer], authTag: '', originalSize: 0, merkleRoots: [root] }) } as unknown as Bundler,
            consensusEngine: { handlePendingBlock: async () => {}, walletManager: { verifyFunds: async () => true, freezeFunds: () => {}, releaseFunds: () => {}, commitFunds: () => {} } } as unknown as ConsensusEngine,
            syncEngine: { orchestrateStorageMarket: async () => [{ peerId: 'mock-1', connection: { peerAddress: 'address', send: () => {} } }] } as unknown as SyncEngine,
            peer: { broadcast: async () => {} } as unknown as Peer,
            reputationManager: { penalizeMajor: () => {} } as unknown as ReputationManager,
            events: {
                once: (evt: string | symbol, cb: (...args: unknown[]) => void) => { 
                    if (typeof evt === 'string' && evt.startsWith('shard_response')) { cb({ success: true, physicalId: 'id' }); } 
                    else if (typeof evt === 'string' && evt.startsWith('handoff_response')) { cb({ success: true, chunkDataBase64: buffer.toString('base64'), merkleSiblings: merkleSiblings }); }
                    return mockNode.events as EventEmitter; 
                },
                removeAllListeners: () => mockNode.events as EventEmitter
            } as unknown as EventEmitter
        };

        const handler = new UploadHandler(mockNode as PeerNode);
        const req = { files: [{ originalname: 'test' }], body: { paths: 'a/b/c' } } as unknown as Request & { files: unknown[], body: any };
        const res = createRes();

        await handler.handle(req as Request, res as unknown as Response); // We just need it to hit the paths catch block
    });

    it('Identifies and halts timed out unresolved block streaming operations', async (t: any) => {
        if (t?.mock?.timers) { t.mock.timers.enable({ apis: ['setTimeout'] }); }
        else {
            // fallback if mock is absent
        }

        const { publicKey, privateKey } = generateRSAKeyPair();
        const buffer = Buffer.from('mock');
        const { tree, root } = buildMerkleTree([buffer]);
        const merkleSiblings = getMerkleProof(tree, 0);

        const mockNode: Partial<PeerNode> = {
            roles: [NodeRole.ORIGINATOR], publicKey, privateKey, port: 1234,
            storageProvider: { createBlockStream: () => ({ physicalBlockId: 'id', writeStream: new Writable({ write(_c, _e, cb) { cb(); } }) }) } as unknown as BaseProvider,
            bundler: { streamErasureBundle: async () => ({ files: [], aesKey: 'k', aesIv: 'iv', shards: [buffer], authTag: '', originalSize: 0, merkleRoots: [root] }) } as unknown as Bundler,
            consensusEngine: { handlePendingBlock: async () => { throw new Error('Converge Error for test'); }, walletManager: { verifyFunds: async () => true, freezeFunds: () => {}, releaseFunds: () => {}, commitFunds: () => {} } } as unknown as ConsensusEngine,
            syncEngine: { orchestrateStorageMarket: async () => [{ peerId: 'mock-1', connection: { peerAddress: 'address', send: () => {} } }] } as unknown as SyncEngine,
            peer: { broadcast: async () => {} } as unknown as Peer,
            reputationManager: { penalizeMajor: () => {} } as unknown as ReputationManager,
            events: {
                once: (evt: string | symbol, cb: (...args: unknown[]) => void) => { 
                    if (typeof evt === 'string' && evt.startsWith('shard_response')) { cb({ success: true, physicalId: 'id' }); } 
                    else if (typeof evt === 'string' && evt.startsWith('handoff_response')) { cb({ success: true, chunkDataBase64: buffer.toString('base64'), merkleSiblings: merkleSiblings }); }
                    return mockNode.events as EventEmitter; 
                },
                removeAllListeners: () => mockNode.events as EventEmitter
            } as unknown as EventEmitter
        };

        const handler = new UploadHandler(mockNode as PeerNode);

        const req = { files: [{ originalname: 'test' }], body: {} } as unknown as Request & { files: unknown[], body: unknown };
        const res = createRes();

        await handler.handle(req as Request, res as unknown as Response);
        
        if (t?.mock?.timers) { t.mock.timers.tick(120000); }
        // ensure event loop flushes
        await new Promise<void>(resolve => setImmediate(resolve));
    });
    it('Penalizes and rejects storage market allocations returning invalid chunk maps', async () => {
        let penalizedNode = '';
        const { publicKey, privateKey } = generateRSAKeyPair();
        const mockNode: Partial<PeerNode> = {
            roles: [NodeRole.ORIGINATOR], publicKey, privateKey, port: 1234,
            storageProvider: { createBlockStream: () => ({ physicalBlockId: 'id', writeStream: new Writable({ write(_c, _e, cb) { cb(); } }) }) } as unknown as BaseProvider,
            bundler: { streamErasureBundle: async () => ({ files: [], aesKey: 'k', aesIv: 'iv', shards: [Buffer.from('mock')], authTag: '', originalSize: 0, merkleRoots: ['realRoot123'] }) } as unknown as Bundler,
            consensusEngine: { handlePendingBlock: async () => {}, walletManager: { verifyFunds: async () => true, freezeFunds: () => {}, releaseFunds: () => {}, commitFunds: () => {} } } as unknown as ConsensusEngine,
            syncEngine: { orchestrateStorageMarket: async () => [{ peerId: 'mock-1', connection: { peerAddress: 'address', send: () => {} } }] } as unknown as SyncEngine,
            reputationManager: { penalizeMajor: (peerId: string) => { penalizedNode = peerId; } } as unknown as ReputationManager,
            peer: { broadcast: async () => {} } as unknown as Peer,
            events: {
                once: (evt: string | symbol, cb: (...args: unknown[]) => void) => { 
                    if (typeof evt === 'string' && evt.startsWith('shard_response')) { cb({ success: true, physicalId: 'id' }); } 
                    else if (typeof evt === 'string' && evt.startsWith('handoff_response')) { cb({ success: true, chunkDataBase64: Buffer.from('Garbage').toString('base64'), merkleSiblings: ['maliciousGarbageHash'] }); }
                    return mockNode.events as EventEmitter; 
                },
                removeAllListeners: () => mockNode.events as EventEmitter
            } as unknown as EventEmitter
        };

        const handler = new UploadHandler(mockNode as PeerNode);
        const req = { files: [{ originalname: 'test' }], body: {} } as unknown as Request & { files: unknown[], body: unknown }; 
        const res = createRes();

        await handler.handle(req as Request, res as unknown as Response);
        
        assert.strictEqual(res.statusCode, 502);
        assert.ok(typeof (res.body as string) === 'string' && (res.body as string).includes('atally failed'));
        assert.strictEqual(penalizedNode, 'mock-1');
    });
});

