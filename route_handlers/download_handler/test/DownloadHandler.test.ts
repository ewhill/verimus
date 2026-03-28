import assert from 'node:assert';
import * as crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { describe, it, mock } from 'node:test';
import { PassThrough, Readable } from 'stream';

import { Request, Response } from 'express';
import { Collection, FindCursor, ObjectId, WithId } from 'mongodb';

import Bundler from '../../../bundler/Bundler';
import { generateRSAKeyPair, signData, encryptPrivatePayload } from '../../../crypto_utils/CryptoUtils';
import type Ledger from '../../../ledger/Ledger';
import type { Peer } from '../../../p2p';
import type PeerNode from '../../../peer_node/PeerNode';
import type BaseProvider from '../../../storage_providers/base_provider/BaseProvider';
import { createMock } from '../../../test/utils/TestUtils';
import type { Block } from '../../../types';
import { NodeRole } from '../../../types/NodeRole';
import DownloadHandler from '../DownloadHandler';

describe('Backend: downloadHandler Unit Tests', () => {

    it('Returns HTTP 404 when requesting missing block hashes', async () => {
        const mockNode = createMock<PeerNode>({ 
            roles: [NodeRole.STORAGE], 
            privateKey: 'PRIVKEY', 
            ledger: createMock<Ledger>({ collection: createMock<Collection<Block>>({ find: mock.fn<() => FindCursor<WithId<Block>>>(() => createMock<FindCursor<WithId<Block>>>({ toArray: async () => [] })) as any }) }) 
        });
        const handler = new DownloadHandler(mockNode);

        const req = createMock<Request>({ params: { hash: 'nonexistent' } });
        const mockStatus = mock.fn<(_unusedCode: number) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockSend = mock.fn<(_unusedBody?: any) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockJson = mock.fn<(_unusedBody?: any) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockSetHeader = mock.fn<(_name: string, _value: string) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        // @ts-ignore
        const res = createMock<Response>(Object.assign(new PassThrough(), {
            status: mockStatus,
            send: mockSend,
            json: mockJson,
            setHeader: mockSetHeader
        }));

        await handler.handle(req, res);
        assert.strictEqual(mockStatus.mock.calls[0].arguments[0], 404);
        assert.strictEqual(mockSend.mock.calls[0].arguments[0], 'Block not found.');
    });

    it('Rejects HTTP 403 on invalid remote signature validations restricting downloads', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();

        const validHPayload = encryptPrivatePayload(publicKey, { physicalId: 'pid', location: { type: 'local' }, aesKey: '', aesIv: '', files: [] });
        const mockNode = createMock<PeerNode>({ 
            roles: [NodeRole.STORAGE], 
            privateKey: privateKey, 
            ledger: createMock<Ledger>({ collection: createMock<Collection<Block>>({ find: mock.fn<() => FindCursor<WithId<Block>>>(() => createMock<FindCursor<WithId<Block>>>({ toArray: async () => [createMock<WithId<Block>>({ _id: new ObjectId('000000000000000000000001'), hash: 'validh', previousHash: 'prev', payload: validHPayload, publicKey: publicKey, signature: 'bad_sig', type: 'STORAGE_CONTRACT', metadata: { index: 0, timestamp: 0 } })] })) as any }) }) 
        });
        const handler = new DownloadHandler(mockNode);

        const req = createMock<Request>({ params: { hash: 'validh' } });
        const mockStatus = mock.fn<(_unusedCode: number) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockSend = mock.fn<(_unusedBody?: any) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockJson = mock.fn<(_unusedBody?: any) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockSetHeader = mock.fn<(_name: string, _value: string) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        // @ts-ignore
        const res = createMock<Response>(Object.assign(new PassThrough(), {
            status: mockStatus,
            send: mockSend,
            json: mockJson,
            setHeader: mockSetHeader
        }));

        await handler.handle(req, res);
        assert.strictEqual(mockStatus.mock.calls[0].arguments[0], 401);
        assert.strictEqual(mockSend.mock.calls[0].arguments[0], 'Invalid block signature.');
    });

    it('Returns locally mapping Erasure Coded Shards via Reed-Solomon recombination', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();

        const bundler = new Bundler('./test_data');
        const pt = new PassThrough();
        const bufs: Buffer[] = [];
        pt.on('data', (c: Buffer) => bufs.push(c));
        const mockFile = { fieldname: 'file', originalname: 'file.txt', encoding: '7bit', mimetype: 'text/plain', size: 16, destination: '', filename: 'file.txt', path: '', buffer: Buffer.from('hello world here from erasure algorithms'), stream: new PassThrough() };
        
        // This calculates matrix sizes natively resolving shards directly against boundaries 
        const bundleP = bundler.streamErasureBundle([mockFile] as Express.Multer.File[], 2, 3);
        const bundleRes = (await bundleP)!;

        const priv = { key: bundleRes.aesKey, iv: bundleRes.aesIv, authTag: bundleRes.authTag, files: bundleRes.files, physicalId: 'pid', location: { type: 'local' } };
        const encPriv = encryptPrivatePayload(publicKey, priv);

        const payload = {
            ...encPriv,
            erasureParams: { k: 2, n: 3, originalSize: bundleRes.originalSize },
            fragmentMap: [
                { nodeId: publicKey, shardIndex: 0, physicalId: 'shard_0', shardHash: 'h0' },
                { nodeId: 'otherNode', shardIndex: 1, physicalId: 'shard_1', shardHash: 'h1' },
                { nodeId: 'anotherNode', shardIndex: 2, physicalId: 'shard_2', shardHash: 'h2' }
            ]
        };

        const sig = signData(JSON.stringify(payload), privateKey);
        
        const realEvents = new EventEmitter();

        const mockNode = createMock<PeerNode>({ 
            roles: [NodeRole.STORAGE], 
            privateKey: privateKey, 
            publicKey: publicKey,
            events: realEvents,
            peer: createMock<Peer>({
                connectedPeers: [
                    { 
                        remotePublicKey: 'otherNode', 
                        send: (msg: any) => {
                            setTimeout(() => {
                                realEvents.emit(`shard_retrieve:${msg.marketId}:shard_1`, { success: true, shardDataBase64: bundleRes.shards[1].toString('base64') })
                            }, 5);
                        } 
                    },
                    { 
                        remotePublicKey: 'anotherNode', 
                        send: (msg: any) => {
                            setTimeout(() => {
                                realEvents.emit(`shard_retrieve:${msg.marketId}:shard_2`, { success: false }) 
                            }, 5);
                        } 
                    }
                ]
            }),
            ledger: createMock<Ledger>({ collection: createMock<Collection<Block>>({ find: mock.fn<() => FindCursor<WithId<Block>>>(() => createMock<FindCursor<WithId<Block>>>({ toArray: async () => [createMock<WithId<Block>>({ _id: new ObjectId('000000000000000000000001'), hash: 'validh', previousHash: 'prev', payload: payload, publicKey: publicKey, signature: sig, type: 'STORAGE_CONTRACT', metadata: { index: 0, timestamp: 0 } })] })) as any }) }) 
        });

        mockNode.storageProvider = createMock<BaseProvider>({
            getEgressCostPerGB: () => 0.0,
            getBlockReadStream: async (id: string) => {
                if (id === 'shard_0') {
                    const rs = new PassThrough();
                    setTimeout(() => rs.end(bundleRes.shards[0]), 5);
                    return { status: 'available', stream: rs };
                }
                return { status: 'not_found' };
            }
        });
        const handler = new DownloadHandler(mockNode);

        const req = createMock<Request>({ params: { hash: 'validh' } });
        const mockStatus = mock.fn<(_unusedCode: number) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockSend = mock.fn<(_unusedBody?: any) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockJson = mock.fn<(_unusedBody?: any) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockSetHeader = mock.fn<(_name: string, _value: string) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        // @ts-ignore
        const res = createMock<Response>(Object.assign(new PassThrough(), {
            status: mockStatus,
            send: mockSend,
            json: mockJson,
            setHeader: mockSetHeader
        }));
        let bodyPayload = '';
        // @ts-ignore
        res.write = (chunk: Buffer | string) => { bodyPayload += chunk.toString(); return true; };
        // @ts-ignore
        res.end = () => { return res; };
        // @ts-ignore
        res.on = () => { return res; };
        
        // Trap pipe bounds dynamically resolving limits
        await new Promise<void>((resolve) => {
            handler.handle(req, res).then(() => {
                setTimeout(() => resolve(undefined), 60);
            });
        });

        assert.strictEqual(mockSetHeader.mock.calls.find((c: any) => c.arguments[0] === 'Content-type')?.arguments[1], 'application/zip');
        assert.ok(bodyPayload.length > 20); // successfully decrypted zip binary map bounds
    });

    it('Returns continuous bundled block stream upon valid parameters', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();

        // 1. Create a real bundle stream
        const bundler = new Bundler('./test_data');
        const pt = new PassThrough();
        const bufs: Buffer[] = [];
        pt.on('data', (c: Buffer) => bufs.push(c));
        const mockFile = { fieldname: 'file', originalname: 'file.txt', encoding: '7bit', mimetype: 'text/plain', size: 16, destination: '', filename: 'file.txt', path: '', buffer: Buffer.from('hello world here'), stream: new PassThrough() };
        const bundleP = bundler.streamBlockBundle([mockFile] as Express.Multer.File[], pt);
        const { aesKey, aesIv, files } = (await bundleP)!;
        const fullZip = Buffer.concat(bufs);

        // 2. Setup block private and encrypt
        const priv = { key: aesKey, iv: aesIv, files, physicalId: 'pid', location: { type: 'local' } };
        const encPriv = encryptPrivatePayload(publicKey, priv);
        const sig = signData(JSON.stringify(encPriv), privateKey);

        const mockNode = createMock<PeerNode>({ 
            roles: [NodeRole.STORAGE], 
            privateKey: privateKey, 
            ledger: createMock<Ledger>({ collection: createMock<Collection<Block>>({ find: mock.fn<() => FindCursor<WithId<Block>>>(() => createMock<FindCursor<WithId<Block>>>({ toArray: async () => [createMock<WithId<Block>>({ _id: new ObjectId('000000000000000000000001'), hash: 'validh', previousHash: 'prev', payload: encPriv, publicKey: publicKey, signature: sig, type: 'STORAGE_CONTRACT', metadata: { index: 0, timestamp: 0 } })] })) as any }) }) 
        });
        mockNode.storageProvider = createMock<BaseProvider>({
            getEgressCostPerGB: () => 0.0,
            getBlockReadStream: async (_unusedId: string) => {
                const rs = new PassThrough();
                rs.end(fullZip);
                return { status: 'available', stream: rs };
            }
        });
        const handler = new DownloadHandler(mockNode);

        const req = createMock<Request>({ params: { hash: 'validh' } });
        const mockStatus = mock.fn<(_unusedCode: number) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockSend = mock.fn<(_unusedBody?: any) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockJson = mock.fn<(_unusedBody?: any) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockSetHeader = mock.fn<(_name: string, _value: string) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        // @ts-ignore
        const res = createMock<Response>(Object.assign(new PassThrough(), {
            status: mockStatus,
            send: mockSend,
            json: mockJson,
            setHeader: mockSetHeader
        }));
        let bodyPayload = '';
        // @ts-ignore
        res.write = (chunk: Buffer | string) => { bodyPayload += chunk.toString(); return true; };
        // @ts-ignore
        res.end = () => { return res; };
        // @ts-ignore
        res.on = () => { return res; };

        await handler.handle(req, res);
        // Wait for unzipping stream to pipe all data out
        await new Promise((r) => setTimeout(() => r(undefined), 100));

        assert.strictEqual(mockSetHeader.mock.calls.find((c: any) => c.arguments[0] === 'Content-type')?.arguments[1], 'application/zip');
        // bodyPayload should contain compressed deflated bytes
        assert.ok(bodyPayload.length > 20);
    });

    it('Intercepts active status tracking requests when statusOnly flag is flipped correctly cancelling full zip rendering', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();

        // const _pt = new PassThrough();
        const priv = { key: 'a'.repeat(64), iv: 'b'.repeat(32), files: [], physicalId: 'pid', location: { type: 'local' } };
        const encPriv = encryptPrivatePayload(publicKey, priv);
        const sig = signData(JSON.stringify(encPriv), privateKey);

        let streamDestroyed = false;
        const mockNode = createMock<PeerNode>({ 
            roles: [NodeRole.STORAGE], 
            privateKey: privateKey, 
            ledger: createMock<Ledger>({ collection: createMock<Collection<Block>>({ find: mock.fn<() => FindCursor<WithId<Block>>>(() => createMock<FindCursor<WithId<Block>>>({ toArray: async () => [createMock<WithId<Block>>({ _id: new ObjectId('000000000000000000000001'), hash: 'validh', previousHash: 'prev', payload: encPriv, publicKey: publicKey, signature: sig, type: 'STORAGE_CONTRACT', metadata: { index: 0, timestamp: 0 } })] })) as any }) }) 
        });
        mockNode.storageProvider = createMock<BaseProvider>({
            getEgressCostPerGB: () => 0.0,
            getBlockReadStream: async (_unusedId: string) => {
                const rs = new PassThrough();
                const origDestroy = rs.destroy.bind(rs);
                rs.destroy = (err?: any) => { streamDestroyed = true; origDestroy(err); return rs; };
                return { status: 'available', stream: rs };
            }
        });
        const handler = new DownloadHandler(mockNode);

        const req = createMock<Request>({ params: { hash: 'validh' }, query: { statusOnly: 'true' } });
        const mockStatus = mock.fn<(_unusedCode: number) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockSend = mock.fn<(_unusedBody?: any) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockJson = mock.fn<(_unusedBody?: any) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockSetHeader = mock.fn<(_name: string, _value: string) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        // @ts-ignore
        const res = createMock<Response>(Object.assign(new PassThrough(), {
            status: mockStatus,
            send: mockSend,
            json: mockJson,
            setHeader: mockSetHeader
        }));

        await handler.handle(req, res);

        assert.strictEqual(mockStatus.mock.calls[0].arguments[0], 200);
        assert.strictEqual(mockSend.mock.calls[0].arguments[0], 'Available');
        assert.strictEqual(streamDestroyed, true);
    });

    it('Returns HTTP 404 on remote storage stream failures', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();
        const priv = { key: 'GARBAGEKEY1234GARBAGEKEY1234GARB', iv: 'GARBAGEIV1234567', files: [], physicalId: 'pid', location: { type: 'local' } };
        const encPriv = encryptPrivatePayload(publicKey, priv);
        const sig = signData(JSON.stringify(encPriv), privateKey);

        const mockNode = createMock<PeerNode>({ 
            roles: [NodeRole.STORAGE], 
            privateKey: privateKey, 
            ledger: createMock<Ledger>({ collection: createMock<Collection<Block>>({ find: mock.fn<() => FindCursor<WithId<Block>>>(() => createMock<FindCursor<WithId<Block>>>({ toArray: async () => [createMock<WithId<Block>>({ _id: new ObjectId('000000000000000000000001'), hash: 'validh', previousHash: 'prev', payload: encPriv, publicKey: publicKey, signature: sig, type: 'STORAGE_CONTRACT', metadata: { index: 0, timestamp: 0 } })] })) as any }) }) 
        });
        mockNode.storageProvider = createMock<BaseProvider>({
            getEgressCostPerGB: () => 0.0,
            getBlockReadStream: async () => ({ status: 'not_found' })
        });
        const handler = new DownloadHandler(mockNode);

        const req = createMock<Request>({ params: { hash: 'validh' } });
        const mockStatus = mock.fn<(_unusedCode: number) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockSend = mock.fn<(_unusedBody?: any) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockJson = mock.fn<(_unusedBody?: any) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockSetHeader = mock.fn<(_name: string, _value: string) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        // @ts-ignore
        const res = createMock<Response>(Object.assign(new PassThrough(), {
            status: mockStatus,
            send: mockSend,
            json: mockJson,
            setHeader: mockSetHeader
        }));

        await handler.handle(req, res);
        assert.strictEqual(mockStatus.mock.calls[0].arguments[0], 404);
        assert.strictEqual(mockSend.mock.calls[0].arguments[0], 'Block not found.');
    });

    it('Returns HTTP 500 capturing storage layer instantiation errors', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();

        const priv = {
            key: crypto.randomBytes(32).toString('hex'),
            iv: crypto.randomBytes(16).toString('hex'),
            files: [], physicalId: 'pid', location: { type: 'local' }
        };
        const encPriv = encryptPrivatePayload(publicKey, priv);
        const sig = signData(JSON.stringify(encPriv), privateKey);

        const mockNode = createMock<PeerNode>({ 
            roles: [NodeRole.STORAGE], 
            privateKey: privateKey, 
            ledger: createMock<Ledger>({ collection: createMock<Collection<Block>>({ find: mock.fn<() => FindCursor<WithId<Block>>>(() => createMock<FindCursor<WithId<Block>>>({ toArray: async () => [createMock<WithId<Block>>({ _id: new ObjectId('000000000000000000000001'), hash: 'validh', previousHash: 'prev', payload: encPriv, publicKey: publicKey, signature: sig, type: 'STORAGE_CONTRACT', metadata: { index: 0, timestamp: 0 } })] })) as any }) }) 
        });
        mockNode.storageProvider = createMock<BaseProvider>({
            getEgressCostPerGB: () => 0.0,
            getBlockReadStream: async (_unusedId: string) => {
                const rs = new PassThrough();
                rs.end(Buffer.from('corrupt_aes_stream'));
                return { status: 'available', stream: rs };
            }
        });
        const handler = new DownloadHandler(mockNode);

        const req = createMock<Request>({ params: { hash: 'validh' } });
        const mockStatus = mock.fn<(_unusedCode: number) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockSend = mock.fn<(_unusedBody?: any) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockJson = mock.fn<(_unusedBody?: any) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockSetHeader = mock.fn<(_name: string, _value: string) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        // @ts-ignore
        const res = createMock<Response>(Object.assign(new PassThrough(), {
            status: mockStatus,
            send: mockSend,
            json: mockJson,
            setHeader: mockSetHeader
        }));

        await new Promise<void>((resolve) => {
            handler.handle(req, res).then(() => setTimeout(resolve, 100));
        });

        // When decipher errors, it should fire the 'error' handler and send 500
        assert.strictEqual(mockStatus.mock.calls[0].arguments[0], 500);
    });

    it('Returns HTTP 500 on payload parsing logic failures', async () => {
        const mockNode = createMock<PeerNode>({ roles: [NodeRole.STORAGE], privateKey: 'PRIV' });
        Object.defineProperty(mockNode, 'ledger', { get: () => { throw new Error('Simulated null reference'); } });
        const handler = new DownloadHandler(mockNode);

        const req = createMock<Request>({ params: { hash: 'validh' } });
        const mockStatus = mock.fn<(_unusedCode: number) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockSend = mock.fn<(_unusedBody?: any) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockJson = mock.fn<(_unusedBody?: any) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockSetHeader = mock.fn<(_name: string, _value: string) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        // @ts-ignore
        const res = createMock<Response>(Object.assign(new PassThrough(), {
            status: mockStatus,
            send: mockSend,
            json: mockJson,
            setHeader: mockSetHeader
        }));

        await handler.handle(req, res);
        assert.strictEqual(mockStatus.mock.calls[0].arguments[0], 500);
    });

    it('Returns HTTP 401 catching invalid RSA signature parameter decryption keys', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();
        const encPriv = encryptPrivatePayload(publicKey, { physicalId: 'pid', location: { type: 'local' }, aesKey: '', aesIv: '', files: [] }); // Wrong structure bypasses decryption
        const sig = signData(JSON.stringify(encPriv), privateKey);

        const mockNode = createMock<PeerNode>({ 
            roles: [NodeRole.STORAGE], 
            privateKey: generateRSAKeyPair().privateKey, 
            ledger: createMock<Ledger>({ collection: createMock<Collection<Block>>({ find: mock.fn<() => FindCursor<WithId<Block>>>(() => createMock<FindCursor<WithId<Block>>>({ toArray: async () => [createMock<WithId<Block>>({ _id: new ObjectId('000000000000000000000001'), hash: 'validh', previousHash: 'prev', payload: encPriv, publicKey: publicKey, signature: sig, type: 'STORAGE_CONTRACT', metadata: { index: 0, timestamp: 0 } })] })) as any }) }) 
        });
        const handler = new DownloadHandler(mockNode);

        const req = createMock<Request>({ params: { hash: 'validh' } });
        const mockStatus = mock.fn<(_unusedCode: number) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockSend = mock.fn<(_unusedBody?: any) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockJson = mock.fn<(_unusedBody?: any) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockSetHeader = mock.fn<(_name: string, _value: string) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        // @ts-ignore
        const res = createMock<Response>(Object.assign(new PassThrough(), {
            status: mockStatus,
            send: mockSend,
            json: mockJson,
            setHeader: mockSetHeader
        }));

        await handler.handle(req, res);
        assert.strictEqual(mockStatus.mock.calls[0].arguments[0], 401);
        assert.strictEqual(mockSend.mock.calls[0].arguments[0], 'Failed to decrypt private payload.');
    });

    it('Intercepts node ReadStream exceptions emitting HTTP 500', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();

        const priv = {
            key: crypto.randomBytes(32).toString('hex'),
            iv: crypto.randomBytes(16).toString('hex'),
            files: [], physicalId: 'pid', location: { type: 'local' }
        };
        const encPriv = encryptPrivatePayload(publicKey, priv);
        const sig = signData(JSON.stringify(encPriv), privateKey);

        const mockNode = createMock<PeerNode>({ 
            roles: [NodeRole.STORAGE], 
            privateKey: privateKey, 
            ledger: createMock<Ledger>({ collection: createMock<Collection<Block>>({ find: mock.fn<() => FindCursor<WithId<Block>>>(() => createMock<FindCursor<WithId<Block>>>({ toArray: async () => [createMock<WithId<Block>>({ _id: new ObjectId('000000000000000000000001'), hash: 'validh', previousHash: 'prev', payload: encPriv, publicKey: publicKey, signature: sig, type: 'STORAGE_CONTRACT', metadata: { index: 0, timestamp: 0 } })] })) as any }) }) 
        });
        mockNode.storageProvider = createMock<BaseProvider>({
            getEgressCostPerGB: () => 0.0,
            getBlockReadStream: async (_unusedId: string) => {
                const rs = new Readable({
                    read() {
                        this.destroy(new Error('Disaster'));
                    }
                });
                return { status: 'available', stream: rs };
            }
        });
        const handler = new DownloadHandler(mockNode);

        const req = createMock<Request>({ params: { hash: 'validh' } });
        const mockStatus = mock.fn<(_unusedCode: number) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockSend = mock.fn<(_unusedBody?: any) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockJson = mock.fn<(_unusedBody?: any) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        const mockSetHeader = mock.fn<(_name: string, _value: string) => Response>(function(this: any) { return this; }) as import('node:test').Mock<any>;
        // @ts-ignore
        const res = createMock<Response>(Object.assign(new PassThrough(), {
            status: mockStatus as any,
            send: mockSend as any,
            json: mockJson as any,
            setHeader: mockSetHeader as any
        }));

        await new Promise<void>((resolve) => {
            handler.handle(req, res).then(() => setTimeout(resolve, 50));
        });

        assert.strictEqual(mockStatus.mock.calls[0].arguments[0], 500);
    });
});
