import assert from 'node:assert';
import { describe, it, beforeEach } from 'node:test';

import { generateRSAKeyPair, encryptPrivatePayload } from '../../../crypto_utils/CryptoUtils';
import BlocksHandler from '../BlocksHandler';

describe('Backend: blocksHandler Coverage', () => {
    let mockNode: any;
    let req: any;
    let res: any;
    let keys: any;

    beforeEach(() => {
        keys = generateRSAKeyPair();
        mockNode = {
            publicKey: 'testPubKey',
            privateKey: keys.privateKey,
            ledger: {
                collection: {
                    find: () => ({
                        sort: () => ({
                            toArray: async () => []
                        })
                    })
                }
            },
            mempool: {
                pendingBlocks: new Map()
            }
        };

        req = { query: {} };
        res = {
            jsonStr: '',
            statusObj: 200,
            json(data: any) { this.jsonStr = JSON.stringify(data); return this; },
            status(code: number) { this.statusObj = code; return this; }
        };
    });

    it('Returns empty blocks list', async () => {
        const handler = new BlocksHandler(mockNode as any);
        await handler.handle(req as any, res as any);
        
        const responseData = JSON.parse(res.jsonStr);
        assert.strictEqual(responseData.success, true);
        assert.strictEqual(responseData.blocks.length, 0);
    });

    it('Returns fetched blocks', async () => {
        const encrypted = encryptPrivatePayload(keys.publicKey, { files: [{ path: 'test.txt' }] });
        
        mockNode.ledger.collection.find = () => ({
            sort: () => ({
                toArray: async () => [{ metadata: { index: 1 }, hash: 'hash1', publicKey: 'testPubKey', payload: encrypted }]
            })
        });

        const handler = new BlocksHandler(mockNode as any);
        await handler.handle(req as any, res as any);
        
        const responseData = JSON.parse(res.jsonStr);
        assert.strictEqual(responseData.blocks.length, 1);
        assert.strictEqual(responseData.blocks[0].hash, 'hash1');
    });

    it('Filters by local queries', async () => {
        const encryptedMatch = encryptPrivatePayload(keys.publicKey, { files: [{ path: 'match-this.txt' }] });
        const encryptedNoMatch = encryptPrivatePayload(keys.publicKey, { files: [{ path: 'other.txt' }] });
        
        mockNode.ledger.collection.find = () => ({
            sort: () => ({
                toArray: async () => [
                    { metadata: { index: 1 }, hash: 'hash1', publicKey: 'testPubKey', payload: encryptedMatch },
                    { metadata: { index: 2 }, hash: 'hash2', publicKey: 'testPubKey', payload: encryptedNoMatch }
                ]
            })
        });

        req.query.q = 'match';
        
        const handler = new BlocksHandler(mockNode as any);
        await handler.handle(req as any, res as any);
        
        const responseData = JSON.parse(res.jsonStr);
        assert.strictEqual(responseData.blocks.length, 1);
        assert.strictEqual(responseData.blocks[0].hash, 'hash1');
    });
    
    it('Appends pending blocks', async () => {
        const encrypted = encryptPrivatePayload(keys.publicKey, { files: [{ path: 'pending.txt' }] });
        mockNode.mempool.pendingBlocks.set('some-sig', { 
            committed: false,
            block: { signature: 'some-sig', publicKey: 'testPubKey', payload: encrypted, metadata: { timestamp: 12345 } }
        });

        const handler = new BlocksHandler(mockNode as any);
        await handler.handle(req as any, res as any);

        const responseData = JSON.parse(res.jsonStr);
        assert.strictEqual(responseData.blocks.length, 1);
        assert.strictEqual(responseData.blocks[0].metadata.index, -1);
    });

    it('Returns 500 error on failure', async () => {
        const handler = new BlocksHandler(null as any);
        await handler.handle(req as any, res as any);
        assert.strictEqual(res.statusObj, 500);
        const responseData = JSON.parse(res.jsonStr);
        assert.strictEqual(responseData.success, false);
    });

    it('Filters by own blocks', async () => {
        const encrypted = encryptPrivatePayload(keys.publicKey, { files: [{ path: 'test.txt' }] });
        
        mockNode.mempool.pendingBlocks.set('some-sig', { 
            committed: false,
            block: { signature: 'some-sig', publicKey: 'otherKey', payload: encrypted, metadata: { timestamp: 12345 } }
        });
        mockNode.mempool.pendingBlocks.set('some-sig2', { 
            committed: false,
            block: { signature: 'some-sig2', publicKey: 'testPubKey', payload: encrypted, metadata: { timestamp: 123456 } }
        });

        req.query.own = 'true';

        const handler = new BlocksHandler(mockNode as any);
        await handler.handle(req as any, res as any);
        
        const responseData = JSON.parse(res.jsonStr);
        // Only the pending block with testPubKey should be returned
        assert.strictEqual(responseData.blocks.length, 1);
        assert.strictEqual(responseData.blocks[0].publicKey, 'testPubKey');
    });

    it('Sorts pending blocks in ASC and DESC', async () => {
        const encrypted = encryptPrivatePayload(keys.publicKey, { files: [{ path: 'test.txt' }] });
        
        mockNode.mempool.pendingBlocks.set('block1', { 
            committed: false,
            block: { signature: 'b1', publicKey: 'testPubKey', payload: encrypted },
            originalTimestamp: 1000
        });
        mockNode.mempool.pendingBlocks.set('block2', { 
            committed: false,
            block: { signature: 'b2', publicKey: 'testPubKey', payload: encrypted },
            originalTimestamp: 2000
        });

        // Test ASC
        req.query.sort = 'asc';
        let handler = new BlocksHandler(mockNode as any);
        await handler.handle(req as any, res as any);
        let resp = JSON.parse(res.jsonStr);
        assert.strictEqual(resp.blocks[0].signature, 'b1');
        assert.strictEqual(resp.blocks[1].signature, 'b2');

        // Test DESC
        res.jsonStr = '';
        req.query.sort = 'desc';
        handler = new BlocksHandler(mockNode as any);
        await handler.handle(req as any, res as any);
        resp = JSON.parse(res.jsonStr);
        assert.strictEqual(resp.blocks[0].signature, 'b2');
        assert.strictEqual(resp.blocks[1].signature, 'b1');
    });

    it('Catches decryption errors', async () => {
        const encryptedMatch = encryptPrivatePayload(keys.publicKey, { files: [{ path: 'match-this.txt' }] });
        
        mockNode.ledger.collection.find = () => ({
            sort: () => ({
                toArray: async () => [
                    { metadata: { index: 1 }, hash: 'hash1', publicKey: 'testPubKey', payload: 'CORRUPTED_PRIVATE_PAYLOAD' },
                    { metadata: { index: 2 }, hash: 'hash2', publicKey: 'testPubKey', payload: encryptedMatch }
                ]
            })
        });

        req.query.q = 'match';
        const handler = new BlocksHandler(mockNode as any);
        await handler.handle(req as any, res as any);
        
        const responseData = JSON.parse(res.jsonStr);
        assert.strictEqual(responseData.blocks.length, 1);
        assert.strictEqual(responseData.blocks[0].hash, 'hash2');
    });
});
