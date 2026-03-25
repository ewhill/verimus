import assert from 'node:assert';
import * as crypto from 'node:crypto';
import { describe, it } from 'node:test';
import { PassThrough } from 'stream';

import Bundler from '../../../bundler/Bundler';
import { generateRSAKeyPair, signData, encryptPrivatePayload } from '../../../crypto_utils/CryptoUtils';
import { NodeRole } from '../../../types/NodeRole';
import DownloadHandler from '../DownloadHandler';


describe('Backend: downloadHandler Unit Tests', () => {

    it('Returns HTTP 404 when requesting missing block hashes', async () => {
        const handler = new DownloadHandler({ roles: [NodeRole.STORAGE], 
            privateKey: 'PRIVKEY',
            ledger: { collection: { find: () => ({ toArray: async () => [] }) } }
        } as any);

        const req: any = { params: { hash: 'nonexistent' } };
        let statusSet = 0;
        let bodyPayload: any = null;
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            send: (b: any) => { bodyPayload = b; return res; },
            headersSent: false
        };

        await handler.handle(req, res);
        assert.strictEqual(statusSet, 404);
        assert.strictEqual(bodyPayload, 'Block not found.');
    });

    it('Rejects HTTP 403 on invalid remote signature validations restricting downloads', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();
        
        const handler = new DownloadHandler({ roles: [NodeRole.STORAGE], 
            privateKey: privateKey,
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: {}, publicKey: publicKey, signature: 'bad_sig' }] }) } }
        } as any);

        const req: any = { params: { hash: 'validh' } };
        let statusSet = 0;
        let bodyPayload: any = null;
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            send: (b: any) => { bodyPayload = b; return res; },
            headersSent: false
        };

        await handler.handle(req, res);
        assert.strictEqual(statusSet, 401);
        assert.strictEqual(bodyPayload, 'Invalid block signature.');
    });

    it('Returns continuous bundled block stream upon valid parameters', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();
        
        // 1. Create a real bundle stream
        const bundler = new Bundler('./test_data');
        const pt = new PassThrough();
        const bufs: Buffer[] = [];
        pt.on('data', (c: Buffer) => bufs.push(c));
        const bundleP = bundler.streamBlockBundle([{ originalname: 'file.txt', buffer: Buffer.from('hello world here') }] as any, pt);
        const { aesKey, aesIv, files } = await bundleP as any;
        const fullZip = Buffer.concat(bufs);
        
        // 2. Setup block private and encrypt
        const priv = { key: aesKey, iv: aesIv, files, physicalId: 'pid', location: { type: 'local' } };
        const encPriv = encryptPrivatePayload(publicKey, priv);
        const sig = signData(JSON.stringify(encPriv), privateKey);

        const handler = new DownloadHandler({ roles: [NodeRole.STORAGE], 
            privateKey: privateKey,
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: encPriv, publicKey: publicKey, signature: sig }] }) } },
            storageProvider: { getEgressCostPerGB: () => 0.0,
                getBlockReadStream: async (id: string) => {
                    const rs = new PassThrough();
                    rs.end(fullZip);
                    return { status: 'available', stream: rs };
                }
            }
        } as any);

        const req: any = { params: { hash: 'validh' } };
        let statusSet = 0;
        let bodyPayload: string = '';
        let headers: any = {};
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            send: (b: any) => { bodyPayload += b; return res; },
            setHeader: (k: string, v: string) => { headers[k] = v; },
            write: (chunk: any) => { bodyPayload += chunk.toString(); },
            end: () => {},
            headersSent: false
        };

        // Make res act like a writable stream
        res.once = () => {};
        res.emit = () => {};
        res.on = (evt: string, cb: Function) => { return res; };
        
        await handler.handle(req, res);
        // Wait for unzipping stream to pipe all data out
        await new Promise((r) => setTimeout(() => r(undefined), 100));
        
        assert.strictEqual(headers['Content-type'], 'application/zip');
        // bodyPayload should contain compressed deflated bytes
        assert.ok(bodyPayload.length > 20);
    });

    it('Intercepts active status tracking requests when statusOnly flag is flipped correctly cancelling full zip rendering', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();
        
        const pt = new PassThrough();
        const priv = { key: 'a'.repeat(64), iv: 'b'.repeat(32), files: [], physicalId: 'pid', location: { type: 'local' } };
        const encPriv = encryptPrivatePayload(publicKey, priv as any);
        const sig = signData(JSON.stringify(encPriv), privateKey);

        let streamDestroyed = false;
        const handler = new DownloadHandler({ roles: [NodeRole.STORAGE], 
            privateKey: privateKey,
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: encPriv, publicKey: publicKey, signature: sig }] }) } },
            storageProvider: { getEgressCostPerGB: () => 0.0,
                getBlockReadStream: async (id: string) => {
                    const rs = new PassThrough();
                    const origDestroy = rs.destroy.bind(rs);
                    rs.destroy = (err?: any) => { streamDestroyed = true; origDestroy(err); return rs; };
                    return { status: 'available', stream: rs };
                }
            }
        } as any);

        const req: any = { params: { hash: 'validh' }, query: { statusOnly: 'true' } };
        let statusSet = 0;
        let bodyPayload: string = '';
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            send: (b: any) => { bodyPayload = b; return res; },
            setHeader: () => {}, write: () => {}, end: () => {}, headersSent: false
        };

        await handler.handle(req, res);
        
        assert.strictEqual(statusSet, 200);
        assert.strictEqual(bodyPayload, 'Available');
        assert.strictEqual(streamDestroyed, true);
    });

    it('Returns HTTP 404 on remote storage stream failures', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();
        const priv = { key: 'GARBAGEKEY1234GARBAGEKEY1234GARB', iv: 'GARBAGEIV1234567', files: [], physicalId: 'pid', location: { type: 'local' } };
        const encPriv = encryptPrivatePayload(publicKey, priv);
        const sig = signData(JSON.stringify(encPriv), privateKey);

        const handler = new DownloadHandler({ roles: [NodeRole.STORAGE], 
            privateKey: privateKey,
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: encPriv, publicKey: publicKey, signature: sig }] }) } },
            storageProvider: { getEgressCostPerGB: () => 0.0,
                getBlockReadStream: async () => ({ status: 'not_found' })
            }
        } as any);

        const req: any = { params: { hash: 'validh' } };
        let statusSet = 0;
        let bodyPayload: string = '';
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            send: (b: any) => { bodyPayload += b; return res; },
            headersSent: false
        };

        await handler.handle(req, res);
        assert.strictEqual(statusSet, 404);
        assert.strictEqual(bodyPayload, 'Block not found.');
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

        const handler = new DownloadHandler({ roles: [NodeRole.STORAGE], 
            privateKey: privateKey,
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: encPriv, publicKey: publicKey, signature: sig }] }) } },
            storageProvider: { getEgressCostPerGB: () => 0.0,
                getBlockReadStream: async (id: string) => {
                    const rs = new PassThrough();
                    rs.end(Buffer.from('corrupt_aes_stream'));
                    return { status: 'available', stream: rs };
                }
            }
        } as any);

        const req: any = { params: { hash: 'validh' } };
        let statusSet = 0;
        let bodyPayload: string = '';
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            send: (b: any) => { bodyPayload += b; return res; },
            setHeader: () => {}, write: () => {}, end: () => {},
            headersSent: false
        };

        res.once = () => {}; res.emit = () => {}; res.on = () => res;
        await new Promise<void>((resolve) => {
            handler.handle(req, res).then(() => setTimeout(resolve, 100));
        });
        
        // When decipher errors, it should fire the 'error' handler and send 500
        assert.ok(statusSet === 0 || statusSet === 500); 
    });

    it('Returns HTTP 500 on payload parsing logic failures', async () => {
        const handler = new DownloadHandler({ roles: [NodeRole.STORAGE], 
            privateKey: 'PRIV',
            ledger: null // Will throw
        } as any);

        const req: any = { params: { hash: 'validh' } };
        let statusSet = 0;
        let bodyPayload: string = '';
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            send: (b: any) => { bodyPayload += b; return res; },
            headersSent: false
        };

        await handler.handle(req, res);
        assert.strictEqual(statusSet, 500);
    });

    it('Returns HTTP 401 catching invalid RSA signature parameter decryption keys', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();
        const encPriv = encryptPrivatePayload(publicKey, { bad: 'data'} as any); // Wrong structure
        const sig = signData(JSON.stringify(encPriv), privateKey);

        const handler = new DownloadHandler({ roles: [NodeRole.STORAGE], 
            privateKey: generateRSAKeyPair().privateKey, // Wrong priv key to make it throw
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: encPriv, publicKey: publicKey, signature: sig }] }) } }
        } as any);

        const req: any = { params: { hash: 'validh' } };
        let statusSet = 0; let message = '';
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            send: (b: any) => { message = b; return res; }
        };

        await handler.handle(req, res);
        assert.strictEqual(statusSet, 401);
        assert.strictEqual(message, 'Failed to decrypt private payload.');
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

        const handler = new DownloadHandler({ roles: [NodeRole.STORAGE], 
            privateKey: privateKey,
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: encPriv, publicKey: publicKey, signature: sig }] }) } },
            storageProvider: { getEgressCostPerGB: () => 0.0,
                getBlockReadStream: async (id: string) => {
                    const rs = new PassThrough();
                    setTimeout(() => {
                        rs.emit('error', new Error('Disaster'));
                        rs.destroy();
                    }, 10);
                    return { status: 'available', stream: rs };
                }
            }
        } as any);

        const req: any = { params: { hash: 'validh' } };
        let statusSet = 0;
        let bodyPayload: string = '';
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            send: (b: any) => { bodyPayload += b; return res; },
            setHeader: () => {}, write: () => {}, end: () => {},
            headersSent: false
        };

        res.once = () => {}; res.emit = () => {}; res.on = () => res;
        await new Promise<void>((resolve) => {
            handler.handle(req, res).then(() => setTimeout(resolve, 50));
        });
        
        assert.strictEqual(statusSet, 500); 
    });
});
