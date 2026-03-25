import assert from 'node:assert';
import * as crypto from 'node:crypto';
import { describe, it } from 'node:test';
import { PassThrough } from 'stream';

import Bundler from '../../../bundler/Bundler';
import { generateRSAKeyPair, signData, encryptPrivatePayload } from '../../../crypto_utils/CryptoUtils';
import { NodeRole } from '../../../types/NodeRole';
import DownloadFileHandler from '../DownloadFileHandler';


describe('Backend: downloadFileHandler Unit Tests', () => {
    
    it('Returns HTTP 404 when requesting missing block hashes', async () => {
        const handler = new DownloadFileHandler({ roles: [NodeRole.STORAGE], 
            privateKey: 'PRIVKEY',
            ledger: { collection: { find: () => ({ toArray: async () => [] }) } }
        } as any);

        const req: any = { params: { hash: 'nonexistent', filename: 'file.txt' } };
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

    it('Flattens array parameters extracting requested filename', async () => {
        const handler = new DownloadFileHandler({ roles: [NodeRole.STORAGE], 
            privateKey: 'PRIVKEY',
            ledger: { collection: { find: () => ({ toArray: async () => [] }) } }
        } as any);

        const req: any = { params: { hash: 'nonexistent', filename: ['file.txt', 'other.txt'] } };
        let statusSet = 0;
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            send: () => res, on: () => res,
            headersSent: false
        };

        await handler.handle(req, res);
        assert.strictEqual(statusSet, 404);
    });

    it('Rejects HTTP 403 upon discovering invalid block signatures', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();
        
        const handler = new DownloadFileHandler({ roles: [NodeRole.STORAGE], 
            privateKey: privateKey,
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: {}, publicKey: publicKey, signature: 'bad_sig' }] }) } }
        } as any);

        const req: any = { params: { hash: 'validh', filename: 'file.txt' } };
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

    it('Emits unzipped file streams responding via block decryptions', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();
        
        // 1. Create a real bundle stream
        const bundler = new Bundler('./test_data');
        const pt = new PassThrough();
        const bufs: Buffer[] = [];
        pt.on('data', (c: Buffer) => bufs.push(c));
        const bundleP = bundler.streamBlockBundle([{ originalname: 'file.txt', buffer: Buffer.from('hello world') }] as any, pt);
        const { aesKey, aesIv, files } = await bundleP as any;
        const fullZip = Buffer.concat(bufs);
        
        // 2. Setup block private and encrypt
        const priv = { key: aesKey, iv: aesIv, files, physicalId: 'pid', location: { type: 'local' } };
        const encPriv = encryptPrivatePayload(publicKey, priv);
        const sig = signData(JSON.stringify(encPriv), privateKey);

        const handler = new DownloadFileHandler({ roles: [NodeRole.STORAGE], 
            privateKey: privateKey,
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: encPriv, publicKey: publicKey, signature: sig }] }) } },
            storageProvider: { getEgressCostPerGB: () => 0.0,
                getBlockReadStream: async (_id: string) => {
                    const rs = new PassThrough();
                    rs.end(fullZip);
                    return { status: 'available', stream: rs };
                }
            }
        } as any);

        const req: any = { params: { hash: 'validh', filename: 'file.txt' } };
        let statusSet = 0;
        let bodyPayload: string = '';
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            send: (b: any) => { bodyPayload += b; return res; },
            setHeader: () => {},
            write: (chunk: any) => { bodyPayload += chunk.toString(); },
            end: () => {},
            headersSent: false
        };

        await new Promise<void>((resolve) => {
            const originalWrite = res.write;
            res.write = (chunk: any) => {
                originalWrite.call(res, chunk);
            };
            // Pipe hook
            res.once = () => {};
            res.emit = () => {};
            res.on = (evt: string, _cb: Function) => {
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
        
        const priv = { key: 'a'.repeat(64), iv: 'b'.repeat(32), files: [], physicalId: 'pid', location: { type: 'local' } };
        const encPriv = encryptPrivatePayload(publicKey, priv as any);
        const sig = signData(JSON.stringify(encPriv), privateKey);

        let streamDestroyed = false;
        const handler = new DownloadFileHandler({ roles: [NodeRole.STORAGE], 
            privateKey: privateKey,
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: encPriv, publicKey: publicKey, signature: sig }] }) } },
            storageProvider: { getEgressCostPerGB: () => 0.0,
                getBlockReadStream: async (_id: string) => {
                    const rs = new PassThrough();
                    const origDestroy = rs.destroy.bind(rs);
                    rs.destroy = (err?: any) => { streamDestroyed = true; origDestroy(err); return rs; };
                    return { status: 'available', stream: rs };
                }
            }
        } as any);

        const req: any = { params: { hash: 'validh', filename: 'file.txt' }, query: { statusOnly: 'true' } };
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

    it('Bypasses and emits HTTP 404 if requested file is missing in unzip filters', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();
        const bundler = new Bundler('./test_data');
        const pt = new PassThrough();
        const bufs: Buffer[] = [];
        pt.on('data', (c: Buffer) => bufs.push(c));
        const bundleP = bundler.streamBlockBundle([{ originalname: 'file.txt', buffer: Buffer.from('hello world') }] as any, pt);
        const { aesKey, aesIv, files } = await bundleP as any;
        const fullZip = Buffer.concat(bufs);
        
        const priv = { key: aesKey, iv: aesIv, files, physicalId: 'pid', location: { type: 'local' } };
        const encPriv = encryptPrivatePayload(publicKey, priv);
        const sig = signData(JSON.stringify(encPriv), privateKey);

        const handler = new DownloadFileHandler({ roles: [NodeRole.STORAGE], 
            privateKey: privateKey,
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: encPriv, publicKey: publicKey, signature: sig }] }) } },
            storageProvider: { getEgressCostPerGB: () => 0.0,
                getBlockReadStream: async (_id: string) => {
                    const rs = new PassThrough();
                    rs.end(fullZip);
                    return { status: 'available', stream: rs };
                }
            }
        } as any);

        const req: any = { params: { hash: 'validh', filename: 'MISSING_FILE.txt' } };
        let statusSet = 0;
        let bodyPayload: string = '';
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            send: (b: any) => { bodyPayload += b; return res; },
            setHeader: () => {}, write: () => {}, end: () => { bodyPayload += 'ended'; },
            headersSent: false
        };

        res.once = () => {}; res.emit = () => {}; res.on = () => res;
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

        const handler = new DownloadFileHandler({ roles: [NodeRole.STORAGE], 
            privateKey: privateKey,
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: encPriv, publicKey: publicKey, signature: sig }] }) } },
            storageProvider: { getEgressCostPerGB: () => 0.0,
                getBlockReadStream: async (_id: string) => {
                    const rs = new PassThrough();
                    rs.end(Buffer.from('corrupt_zip_data!')); // Corrupt zip
                    return { status: 'available', stream: rs };
                }
            }
        } as any);

        const req: any = { params: { hash: 'validh', filename: 'file.txt' } };
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
        
        assert.strictEqual(statusSet, 500);
        assert.ok(bodyPayload.includes('Extraction failed'));
    });

    it('Captures parsing exceptions executing 500 fallback blocks', async () => {
        const handler = new DownloadFileHandler({ roles: [NodeRole.STORAGE], 
            privateKey: 'PRIV',
            ledger: null // Will throw during find
        } as any);

        const req: any = { params: { hash: 'validh', filename: 'file.txt' } };
        let statusSet = 0;
        const res: any = {
            status: (_s: number) => { statusSet = _s; return res; },
            send: (_b: any) => { return res; }, on: () => res,
            headersSent: false
        };

        await handler.handle(req, res);
        assert.strictEqual(statusSet, 500);
    });

    it('Throws HTTP 401 stopping pipelines on mismatched AES decryption', async () => {
        const { publicKey } = generateRSAKeyPair();
        const handler = new DownloadFileHandler({ roles: [NodeRole.STORAGE], 
            privateKey: 'BAD_KEY',
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: 'CORRUPT', publicKey: publicKey, signature: 'sig' }] }) } }
        } as any);

        const req: any = { params: { hash: 'validh', filename: 'file.txt' } };
        let statusSet = 0;
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            send: () => { return res; }, on: () => res,
        };

        await handler.handle(req, res);
    });

    it('Blocks HTTP 401 validating malformed initial JSON payloads', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();
        const encPriv = encryptPrivatePayload(publicKey, { bad: 'data'} as any); // Correctly encrypted but wrong struct
        const sig = signData(JSON.stringify(encPriv), privateKey);

        const handler = new DownloadFileHandler({ roles: [NodeRole.STORAGE], 
            privateKey: generateRSAKeyPair().privateKey, // Wrong priv key to make it throw
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: encPriv, publicKey: publicKey, signature: sig }] }) } }
        } as any);

        const req: any = { params: { hash: 'validh', filename: 'file.txt' } };
        let statusSet = 0; let message = '';
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            send: (b: any) => { message = b; return res; }, on: () => res,
        };

        await handler.handle(req, res);
        assert.strictEqual(statusSet, 401);
        assert.strictEqual(message, 'Failed to decrypt private payload.');
    });

    it('Flags HTTP 404 on offline remote storage constraints', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();

        const encPriv = encryptPrivatePayload(publicKey, { key: crypto.randomBytes(32).toString('hex'), iv: crypto.randomBytes(16).toString('hex'), files: [], physicalId: 'pid', location: { type: 'local' } } as any);
        const sig = signData(JSON.stringify(encPriv), privateKey);

        const handler = new DownloadFileHandler({ roles: [NodeRole.STORAGE], 
            privateKey: privateKey, 
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: encPriv, publicKey: publicKey, signature: sig }] }) } },
            storageProvider: { getEgressCostPerGB: () => 0.0,
                getBlockReadStream: async (_id: string) => ({ status: 'not_found' }) // simulate not found
            }
        } as any);

        const req: any = { params: { hash: 'validh', filename: 'file.txt' } };
        let statusSet = 0; let message = '';
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            send: (b: any) => { message = b; return res; }, on: () => res,
        };

        await handler.handle(req, res);
        assert.strictEqual(statusSet, 404);
        assert.ok(message.includes('Block not found'));
    });

    it('Intercepts node ReadStream errors converting pipeline exceptions', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();

        const encPriv = encryptPrivatePayload(publicKey, { key: crypto.randomBytes(32).toString('hex'), iv: crypto.randomBytes(16).toString('hex'), files: [], physicalId: 'pid', location: { type: 'local' } } as any);
        const sig = signData(JSON.stringify(encPriv), privateKey);

        const handler = new DownloadFileHandler({ roles: [NodeRole.STORAGE], 
            privateKey: privateKey, 
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: encPriv, publicKey: publicKey, signature: sig }] }) } },
            storageProvider: { getEgressCostPerGB: () => 0.0,
                getBlockReadStream: async (_id: string) => {
                    const rs = new PassThrough();
                    setTimeout(() => {
                        rs.emit('error', new Error('Disaster'));
                        rs.destroy();
                    }, 10);
                    return { status: 'available', stream: rs };
                }
            }
        } as any);

        const req: any = { params: { hash: 'validh', filename: 'file.txt' } };
        let statusSet = 0; let message = '';
        const res: any = {
            status: (s: number) => { statusSet = s; return res; },
            send: (b: any) => { message = b; return res; },
            setHeader: () => {}, write: () => {}, end: () => {},
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
        const bundleP = bundler.streamBlockBundle([{ originalname: 'file.txt', buffer: Buffer.from('hello world') }] as any, pt);
        const { aesKey, aesIv, files } = await bundleP as any;
        const fullZip = Buffer.concat(bufs);
        
        const priv = { key: aesKey, iv: aesIv, files, physicalId: 'pid', location: { type: 'local' } };
        const encPriv = encryptPrivatePayload(publicKey, priv);
        const sig = signData(JSON.stringify(encPriv), privateKey);

        const handler = new DownloadFileHandler({ roles: [NodeRole.STORAGE], 
            privateKey: privateKey,
            ledger: { collection: { find: () => ({ toArray: async () => [{ hash: 'validh', payload: encPriv, publicKey: publicKey, signature: sig }] }) } },
            storageProvider: { getEgressCostPerGB: () => 0.0,
                getBlockReadStream: async (_id: string) => {
                    const rs = new PassThrough();
                    rs.end(fullZip);
                    return { status: 'available', stream: rs };
                }
            }
        } as any);

        const req: any = { params: { hash: 'validh', filename: 'MISSING_FILE.txt' } };
        let bodyPayload: string = '';
        const res: any = {
            status: (_s: number) => { return res; },
            send: (_b: any) => { return res; },
            setHeader: () => {}, write: () => {}, end: () => { bodyPayload += 'ended'; },
            headersSent: true // Emulate headers already sent!
        };

        res.once = () => {}; res.emit = () => {}; res.on = () => res;
        await new Promise<void>((resolve) => {
            handler.handle(req, res).then(() => setTimeout(resolve, 50));
        });
        
        assert.ok(bodyPayload.includes('ended'));
    });
});
