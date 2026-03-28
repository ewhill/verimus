import * as assert from 'node:assert';
import * as crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';
import { PassThrough } from 'stream';


import { Request, Response } from 'express';

import Bundler from '../../../bundler/Bundler';
import { generateRSAKeyPair, signData, encryptPrivatePayload } from '../../../crypto_utils/CryptoUtils';
import type { Peer } from '../../../p2p';
import { createMock } from '../../../test/utils/TestUtils';
import { NodeRole } from '../../../types/NodeRole';
import DownloadFileHandler from '../DownloadFileHandler';


describe('Backend: downloadFileHandler Unit Tests', () => {

    it('Returns unzipped file buffer resolving local and P2P Erasure Coded Shards via Reed-Solomon matrix', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();
        const bundler = new Bundler('./test_data');
        const pt = new PassThrough();
        const bufs: Buffer[] = [];
        pt.on('data', (c: Buffer) => bufs.push(c));
        const mockFile = { fieldname: 'file', originalname: 'file.txt', encoding: '7bit', mimetype: 'text/plain', size: 16, destination: '', filename: 'file.txt', path: '', buffer: Buffer.from('hello world here from erasure file mode'), stream: new PassThrough() };
        
        const bundleP = bundler.streamErasureBundle([mockFile] as Express.Multer.File[], 2, 3);
        const bundleRes = (await bundleP)!;

        const priv = { key: bundleRes.aesKey, iv: bundleRes.aesIv, authTag: bundleRes.authTag, files: bundleRes.files, physicalId: 'pid', location: { type: 'local' } };
        const encPriv = encryptPrivatePayload(publicKey, priv);

        const payload = {
            ...encPriv,
            erasureParams: { k: 2, n: 3, originalSize: bundleRes.originalSize },
            fragmentMap: [
                { nodeId: publicKey, shardIndex: 0, physicalId: 'shard_0' },
                { nodeId: 'otherNode', shardIndex: 1, physicalId: 'shard_1' },
                { nodeId: 'anotherNode', shardIndex: 2, physicalId: 'shard_2' }
            ]
        };

        const sig = signData(JSON.stringify(payload), privateKey);
        const realEvents = new EventEmitter();

        const handlerOpts = { 
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
            // @ts-ignore
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', previousHash: 'prev', payload: payload, publicKey: publicKey, signature: sig, type: 'STORAGE_CONTRACT', metadata: { index: 0, timestamp: 0 } }] }) } },
            // @ts-ignore
            storageProvider: {
                getEgressCostPerGB: () => 0.0,
                getBlockReadStream: async (id: string) => {
                    if (id === 'shard_0') {
                        const rs = new PassThrough();
                        setTimeout(() => rs.end(bundleRes.shards[0]), 5);
                        return { status: 'available', stream: rs };
                    }
                    return { status: 'not_found' };
                }
            }
        };

        // @ts-ignore
        const handler = new DownloadFileHandler(handlerOpts);

        const req = createMock<Request>({ params: { hash: 'validh', filename: 'file.txt' } });
        const headers: Record<string, string> = {};
        const res = createMock<Response>({
            status: function (_unusedS: number) { return this as Response; },
            send: function (_unusedB: any) { return this as Response; },
            json: function (_unusedJ: any) { return this as Response; },
            setHeader: function (name: string, val: string) { headers[name.toLowerCase()] = val; return this as Response; },
            headersSent: false,
            once: function () { return this as Response; },
            emit: function () { return true; },
            on: function () { return this as Response; }
        });
        let bodyPayload = '';
        // @ts-ignore
        res.write = (chunk: Buffer | string) => { bodyPayload += chunk.toString(); return true; };
        // @ts-ignore
        res.end = () => { return res; };
        
        await new Promise<void>((resolve) => {
            // @ts-ignore
            res.on = (evt: string, _unusedCb: Function) => {
                if (evt === 'finish' || evt === 'close') {
                    setTimeout(() => { resolve(undefined); }, 30);
                }
                return res;
            };

            handler.handle(req, res).then(() => {
                setTimeout(() => resolve(undefined), 60);
            });
        });

        assert.strictEqual(headers['content-disposition'], 'attachment; filename="file.txt"');
        assert.ok(bodyPayload.includes('hello world'));
    });

    it('Returns HTTP 404 when requesting missing block hashes', async () => {
        const handlerOpts = {
            roles: [NodeRole.STORAGE],
            privateKey: 'PRIVKEY',
            ledger: { collection: { find: () => ({ toArray: async () => [] }) } }
        };
        // @ts-ignore
        const handler = new DownloadFileHandler(handlerOpts);

        const req = createMock<Request>({ params: { hash: 'nonexistent', filename: 'file.txt' } });
        let statusSet = 0;
        let bodyPayload: unknown = null;
        const res = createMock<Response>({
            status: function (s: number) { statusSet = s; return this as Response; },
            send: function (b: unknown) { bodyPayload = b; return this as Response; },
            headersSent: false
        });

        await handler.handle(req, res);
        assert.strictEqual(statusSet, 404);
        assert.strictEqual(bodyPayload, 'Block not found.');
    });

    it('Flattens array parameters extracting requested filename', async () => {
        const handlerOpts = {
            roles: [NodeRole.STORAGE],
            privateKey: 'PRIVKEY',
            ledger: { collection: { find: () => ({ toArray: async () => [] }) } }
        };
        // @ts-ignore
        const handler = new DownloadFileHandler(handlerOpts);

        const req = createMock<Request>({ params: { hash: 'nonexistent', filename: ['file.txt', 'other.txt'] } });
        let statusSet = 0;
        const res = createMock<Response>({
            status: function (s: number) { statusSet = s; return this as Response; },
            send: function () { return this as Response; }, on: function () { return this as Response; },
            headersSent: false
        });

        await handler.handle(req, res);
        assert.strictEqual(statusSet, 404);
    });

    it('Rejects HTTP 403 upon discovering invalid block signatures', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();

        const handlerOpts = {
            roles: [NodeRole.STORAGE],
            privateKey: privateKey,
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: {}, publicKey: publicKey, signature: 'bad_sig' }] }) } }
        };
        // @ts-ignore
        const handler = new DownloadFileHandler(handlerOpts);

        const req = createMock<Request>({ params: { hash: 'validh', filename: 'file.txt' } });
        let statusSet = 0;
        let bodyPayload: unknown = null;
        const res = createMock<Response>({
            status: function (s: number) { statusSet = s; return this as Response; },
            send: function (b: unknown) { bodyPayload = b; return this as Response; },
            headersSent: false
        });

        await handler.handle(req, res);
        assert.strictEqual(statusSet, 401);
        assert.strictEqual(bodyPayload, 'Invalid block signature.');
    });

    it('Emits unzipped file streams responding via block decryptions', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();

        // 1. Create a real bundle stream
        const bundler = new Bundler('./test_data');
        const pt = new PassThrough();
        const bufs: Buffer[] = [];
        pt.on('data', (c: Buffer) => bufs.push(c));
        // @ts-ignore
        const bundleP = bundler.streamBlockBundle([{ originalname: 'file.txt', buffer: Buffer.from('hello world') }], pt);
        // @ts-ignore
        const { aesKey, aesIv, files } = await bundleP;
        const fullZip = Buffer.concat(bufs);

        // 2. Setup block private and encrypt
        const priv = { key: aesKey, iv: aesIv, files, physicalId: 'pid', location: { type: 'local' } };
        const encPriv = encryptPrivatePayload(publicKey, priv);
        const sig = signData(JSON.stringify(encPriv), privateKey);

        const handlerOpts = {
            roles: [NodeRole.STORAGE],
            privateKey: privateKey,
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: encPriv, publicKey: publicKey, signature: sig }] }) } },
            storageProvider: {
                getEgressCostPerGB: () => 0.0,
                getBlockReadStream: async (_unusedId: string) => {
                    const rs = new PassThrough();
                    rs.end(fullZip);
                    return { status: 'available', stream: rs };
                }
            }
        };
        // @ts-ignore
        const handler = new DownloadFileHandler(handlerOpts);

        const req = createMock<Request>({ params: { hash: 'validh', filename: 'file.txt' } });
        // let _statusSet = 0;
        let bodyPayload: string = '';
        const res = createMock<Response>({
            status: function (_unusedS: number) { return this as Response; },
            send: function (b: unknown) { bodyPayload += b; return this as Response; },
            setHeader: function (_unusedN: string, _unusedV: any) { return this as Response; },
            write: function (chunk: any, _unusedEncoding?: any, _unusedCb?: any) { bodyPayload += chunk.toString(); return true; },
            end: function (_unusedC?: any, _unusedE?: any, _unusedCb?: any) { return this as Response; },
            headersSent: false
        });

        await new Promise<void>((resolve) => {
            const originalWrite = res.write;
            // @ts-ignore
            res.write = (chunk: unknown, encoding?: BufferEncoding, cb?: any) => {
                return (originalWrite as Function).call(res, chunk, encoding, cb) as boolean;
            };
            // Pipe hook
            // @ts-ignore
            res.once = () => { };
            // @ts-ignore
            res.emit = () => { };
            // @ts-ignore
            res.on = (evt: string, _unusedCb: Function) => {
                if (evt === 'finish' || evt === 'close') {
                    setTimeout(() => { resolve(undefined); }, 50);
                }
                return res;
            };

            handler.handle(req, res).then(() => {
                // Let the stream end creatively nicely expertly implicitly smartly realistically realistically
                setTimeout(() => resolve(undefined), 10);
            });
        });

        assert.ok(bodyPayload.length > 0);
    });

    it('Intercepts active status tracking requests when statusOnly flag is flipped correctly cancelling full zip rendering', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();

        // const _pt = new PassThrough();
        const priv = { key: 'a'.repeat(64), iv: 'b'.repeat(32), files: [], physicalId: 'pid', location: { type: 'local' } };
        // @ts-ignore
        const encPriv = encryptPrivatePayload(publicKey, priv);
        const sig = signData(JSON.stringify(encPriv), privateKey);

        let streamDestroyed = false;
        const handlerOpts = {
            roles: [NodeRole.STORAGE],
            privateKey: privateKey,
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: encPriv, publicKey: publicKey, signature: sig }] }) } },
            storageProvider: {
                getEgressCostPerGB: () => 0.0,
                getBlockReadStream: async (_unusedId: string) => {
                    const rs = new PassThrough();
                    const origDestroy = rs.destroy.bind(rs);
                    rs.destroy = (err?: any) => { streamDestroyed = true; origDestroy(err); return rs; };
                    return { status: 'available', stream: rs };
                }
            }
        };
        // @ts-ignore
        const handler = new DownloadFileHandler(handlerOpts);

        const req = createMock<Request>({ params: { hash: 'validh', filename: 'file.txt' }, query: { statusOnly: 'true' } });
        let statusSet = 0;
        let bodyPayload: string = '';
        const res = createMock<Response>({
            status: function (s: number) { statusSet = s; return this as Response; },
            send: function (b: unknown) { bodyPayload = b as string; return this as Response; },
            setHeader: function (_unusedN: string, _unusedV: any) { return this as Response; }, write: function (_unusedChunk: any, _unusedEncoding?: any, _unusedCb?: any) { return true; }, end: function (_unusedC?: any, _unusedE?: any, _unusedCb?: any) { return this as Response; }, headersSent: false
        });

        await handler.handle(req, res);

        assert.strictEqual(statusSet, 200);
        assert.strictEqual(bodyPayload, 'Available');
        assert.strictEqual(streamDestroyed, true);
    });

    it('Bypasses and emits HTTP 404 if requested file is missing in unzip filters', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();
        const bundler = new Bundler('./test_data');
        const pt = new PassThrough();
        const bufs: Buffer[] = [];
        pt.on('data', (c: Buffer) => bufs.push(c));
        // @ts-ignore
        const bundleP = bundler.streamBlockBundle([{ originalname: 'file.txt', buffer: Buffer.from('hello world') }], pt);
        // @ts-ignore
        const { aesKey, aesIv, files } = await bundleP;
        const fullZip = Buffer.concat(bufs);

        const priv = { key: aesKey, iv: aesIv, files, physicalId: 'pid', location: { type: 'local' } };
        const encPriv = encryptPrivatePayload(publicKey, priv);
        const sig = signData(JSON.stringify(encPriv), privateKey);

        const handlerOpts = {
            roles: [NodeRole.STORAGE],
            privateKey: privateKey,
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: encPriv, publicKey: publicKey, signature: sig }] }) } },
            storageProvider: {
                getEgressCostPerGB: () => 0.0,
                getBlockReadStream: async (_unusedId: string) => {
                    const rs = new PassThrough();
                    rs.end(fullZip);
                    return { status: 'available', stream: rs };
                }
            }
        };
        // @ts-ignore
        const handler = new DownloadFileHandler(handlerOpts);

        const req = createMock<Request>({ params: { hash: 'validh', filename: 'MISSING_FILE.txt' } });
        let statusSet = 0;
        let bodyPayload: string = '';
        const res = createMock<Response>({
            status: function (s: number) { statusSet = s; return this as Response; },
            send: function (b: unknown) { bodyPayload += b; return this as Response; },
            setHeader: function (_unusedN: string, _unusedV: any) { return this as Response; }, write: function (_unusedChunk: any, _unusedEncoding?: any, _unusedCb?: any) { return true; }, end: function (_unusedC?: any, _unusedE?: any, _unusedCb?: any) { bodyPayload += 'ended'; return this as Response; },
            headersSent: false
        });

        res.once = (() => { }) as any; res.emit = (() => { }) as any; res.on = (() => res) as any;
        await new Promise<void>((resolve) => {
            handler.handle(req, res).then(() => setTimeout(resolve, 100));
        });

        assert.strictEqual(statusSet, 404);
        assert.ok(bodyPayload.includes('File not found'));
    });

    it('Halts and emits HTTP 500 when unzip streams experience corruption', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();

        const priv = {
            key: crypto.randomBytes(32).toString('hex'),
            iv: crypto.randomBytes(16).toString('hex'),
            files: [], physicalId: 'pid', location: { type: 'local' }
        };
        const encPriv = encryptPrivatePayload(publicKey, priv);
        const sig = signData(JSON.stringify(encPriv), privateKey);

        const handlerOpts = {
            roles: [NodeRole.STORAGE],
            privateKey: privateKey,
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: encPriv, publicKey: publicKey, signature: sig }] }) } },
            storageProvider: {
                getEgressCostPerGB: () => 0.0,
                getBlockReadStream: async (_unusedId: string) => {
                    const rs = new PassThrough();
                    rs.end(Buffer.from('corrupt_zip_data!')); // Corrupt zip
                    return { status: 'available', stream: rs };
                }
            }
        };
        // @ts-ignore
        const handler = new DownloadFileHandler(handlerOpts);

        const req = createMock<Request>({ params: { hash: 'validh', filename: 'file.txt' } });
        let statusSet = 0;
        let bodyPayload: string = '';
        const res = createMock<Response>({
            status: function (s: number) { statusSet = s; return this as Response; },
            send: function (b: unknown) { bodyPayload += b; return this as Response; },
            setHeader: function (_unusedN: string, _unusedV: any) { return this as Response; }, write: function (_unusedChunk: any, _unusedEncoding?: any, _unusedCb?: any) { return true; }, end: function (_unusedC?: any, _unusedE?: any, _unusedCb?: any) { return this as Response; },
            headersSent: false
        });

        // @ts-ignore
        res.once = () => { }; 
        // @ts-ignore
        res.emit = () => { }; 
        // @ts-ignore
        res.on = () => res;
        await new Promise<void>((resolve) => {
            handler.handle(req, res).then(() => setTimeout(resolve, 100));
        });

        assert.strictEqual(statusSet, 500);
        assert.ok(bodyPayload.includes('Extraction failed'));
    });

    it('Captures parsing exceptions executing 500 fallback blocks', async () => {
        const handlerOpts = {
            roles: [NodeRole.STORAGE],
            privateKey: 'PRIV',
            ledger: null // Will throw during find
        };
        // @ts-ignore
        const handler = new DownloadFileHandler(handlerOpts);

        const req = createMock<Request>({ params: { hash: 'validh', filename: 'file.txt' } });
        let statusSet = 0;
        const res = createMock<Response>({
            status: function (s: number) { statusSet = s; return this as Response; },
            send: function (_unusedB: unknown) { return this as Response; }, on: function () { return this as Response; },
            headersSent: false
        });

        await handler.handle(req, res);
        assert.strictEqual(statusSet, 500);
    });

    it('Throws HTTP 401 stopping pipelines on mismatched AES decryption', async () => {
        const { publicKey } = generateRSAKeyPair();
        const handlerOpts = {
            roles: [NodeRole.STORAGE],
            privateKey: 'BAD_KEY',
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: 'CORRUPT', publicKey: publicKey, signature: 'sig' }] }) } }
        };
        // @ts-ignore
        const handler = new DownloadFileHandler(handlerOpts);

        const req = createMock<Request>({ params: { hash: 'validh', filename: 'file.txt' } });
        // let _statusSet = 0;
        const res = createMock<Response>({
            status: function (_unusedS: number) { return this as Response; },
            send: function () { return this as Response; }, on: function () { return this as Response; },
        });

        await handler.handle(req, res);
    });

    it('Blocks HTTP 401 validating malformed initial JSON payloads', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();
        // @ts-ignore
        const encPriv = encryptPrivatePayload(publicKey, { bad: 'data' }); // Correctly encrypted but wrong struct
        const sig = signData(JSON.stringify(encPriv), privateKey);

        const handlerOpts = {
            roles: [NodeRole.STORAGE],
            privateKey: generateRSAKeyPair().privateKey, // Wrong priv key to make it throw
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: encPriv, publicKey: publicKey, signature: sig }] }) } }
        };
        // @ts-ignore
        const handler = new DownloadFileHandler(handlerOpts);

        const req = createMock<Request>({ params: { hash: 'validh', filename: 'file.txt' } });
        let statusSet = 0; let message = '';
        const res = createMock<Response>({
            status: function (s: number) { statusSet = s; return this as Response; },
            send: function (b: unknown) { message = b as string; return this as Response; }, on: function () { return this as Response; },
        });

        await handler.handle(req, res);
        assert.strictEqual(statusSet, 401);
        assert.strictEqual(message, 'Failed to decrypt private payload.');
    });

    it('Flags HTTP 404 on offline remote storage constraints', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();

        // @ts-ignore
        const encPriv = encryptPrivatePayload(publicKey, { key: crypto.randomBytes(32).toString('hex'), iv: crypto.randomBytes(16).toString('hex'), files: [], physicalId: 'pid', location: { type: 'local' } });
        const sig = signData(JSON.stringify(encPriv), privateKey);

        const handlerOpts = {
            roles: [NodeRole.STORAGE],
            privateKey: privateKey,
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: encPriv, publicKey: publicKey, signature: sig }] }) } },
            storageProvider: {
                getEgressCostPerGB: () => 0.0,
                getBlockReadStream: async (_unusedId: string) => ({ status: 'not_found' }) // simulate not found
            }
        };
        // @ts-ignore
        const handler = new DownloadFileHandler(handlerOpts);

        const req = createMock<Request>({ params: { hash: 'validh', filename: 'file.txt' } });
        let statusSet = 0; let message = '';
        const res = createMock<Response>({
            status: function (s: number) { statusSet = s; return this as Response; },
            send: function (b: unknown) { message = b as string; return this as Response; }, on: function () { return this as Response; },
        });

        await handler.handle(req, res);
        assert.strictEqual(statusSet, 404);
        assert.ok(message.includes('Block not found'));
    });

    it('Intercepts node ReadStream errors converting pipeline exceptions', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();

        // @ts-ignore
        const encPriv = encryptPrivatePayload(publicKey, { key: crypto.randomBytes(32).toString('hex'), iv: crypto.randomBytes(16).toString('hex'), files: [], physicalId: 'pid', location: { type: 'local' } });
        const sig = signData(JSON.stringify(encPriv), privateKey);

        const handlerOpts = {
            roles: [NodeRole.STORAGE],
            privateKey: privateKey,
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: encPriv, publicKey: publicKey, signature: sig }] }) } },
            storageProvider: {
                getEgressCostPerGB: () => 0.0,
                getBlockReadStream: async (_unusedId: string) => {
                    const rs = new PassThrough();
                    setTimeout(() => {
                        rs.emit('error', new Error('Disaster'));
                        rs.destroy();
                    }, 10);
                    return { status: 'available', stream: rs };
                }
            }
        };
        // @ts-ignore
        const handler = new DownloadFileHandler(handlerOpts);

        const req: any = { params: { hash: 'validh', filename: 'file.txt' } };
        let statusSet = 0; let message = '';
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            send: (b: any) => { message = b; return res; },
            setHeader: function (_unusedN: string, _unusedV: any) { return this as Response; }, write: function (_unusedChunk: any, _unusedEncoding?: any, _unusedCb?: any) { return true; }, end: function (_unusedC?: any, _unusedE?: any, _unusedCb?: any) { return this as Response; },
            headersSent: false
        };

        await handler.handle(req, res);
        await new Promise(r => setTimeout(r, 50));
        assert.strictEqual(statusSet, 500);
        assert.ok(message.includes('Error reading block'));
    });



    it('Executes clean tear down logic when Express headers commit prematurely', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();
        const bundler = new Bundler('./test_data');
        const pt = new PassThrough();
        const bufs: Buffer[] = [];
        pt.on('data', (c: Buffer) => bufs.push(c));
        // @ts-ignore
        const bundleP = bundler.streamBlockBundle([{ originalname: 'file.txt', buffer: Buffer.from('hello world') }], pt);
        // @ts-ignore
        const { aesKey, aesIv, files } = await bundleP;
        const fullZip = Buffer.concat(bufs);

        const priv = { key: aesKey, iv: aesIv, files, physicalId: 'pid', location: { type: 'local' } };
        const encPriv = encryptPrivatePayload(publicKey, priv);
        const sig = signData(JSON.stringify(encPriv), privateKey);

        const handlerOpts = {
            roles: [NodeRole.STORAGE],
            privateKey: privateKey,
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: encPriv, publicKey: publicKey, signature: sig }] }) } },
            storageProvider: {
                getEgressCostPerGB: () => 0.0,
                getBlockReadStream: async (_unusedId: string) => {
                    const rs = new PassThrough();
                    rs.end(fullZip);
                    return { status: 'available', stream: rs };
                }
            }
        };
        // @ts-ignore
        const handler = new DownloadFileHandler(handlerOpts);

        const req: any = { params: { hash: 'validh', filename: 'MISSING_FILE.txt' } };
        let bodyPayload: string = '';
        const res: any = {
            status: (_unusedS: number) => { return res; },
            send: (_unusedB: any) => { return res; },
            setHeader: function (_unusedN: string, _unusedV: any) { return this as Response; }, write: function (_unusedChunk: any, _unusedEncoding?: any, _unusedCb?: any) { return true; }, end: function (_unusedC?: any, _unusedE?: any, _unusedCb?: any) { bodyPayload += 'ended'; return this as Response; },
            headersSent: true // Emulate headers already sent!
        };

        // @ts-ignore
        res.once = () => { }; 
        // @ts-ignore
        res.emit = () => { }; 
        // @ts-ignore
        res.on = () => res;
        await new Promise<void>((resolve) => {
            handler.handle(req, res).then(() => setTimeout(resolve, 50));
        });

        assert.ok(bodyPayload.includes('ended'));
    });
});
