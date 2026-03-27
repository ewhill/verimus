import assert from 'node:assert';
import { describe, it, beforeEach, mock } from 'node:test';

import { generateRSAKeyPair, encryptPrivatePayload } from '../../../crypto_utils/CryptoUtils';
import BlocksHandler from '../BlocksHandler';

function createRes() {
    const res: any = { statusCode: 200, body: null };
    res.status = (code: number) => { res.statusCode = code; return res; };
    res.json = (data: any) => { res.body = data; return res; };
    res.send = (data: any) => { res.body = data; return res; };
    return res;
}

const createValidPendingBlock = (sig: string, pub: string, payload: any, ts: number) => ({
    committed: false,
    verifications: new Set<string>(),
    eligible: true,
    originalTimestamp: ts,
    block: {
        hash: 'hash_' + sig,
        previousHash: 'prev',
        type: 'STORAGE_CONTRACT' as const,
        metadata: { index: -1, timestamp: ts },
        publicKey: pub,
        signature: sig,
        payload: payload
    }
});

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
            ledger: { collection: { find: mock.fn(() => ({ sort: () => ({ toArray: async () => [] }) })) } },
            mempool: { pendingBlocks: new Map() }
        };

        req = { query: {} };
        res = createRes();
    });

    it('Returns empty blocks list', async () => {
        const handler = new BlocksHandler(mockNode);
        await handler.handle(req, res);
        
        const responseData = res.body;
        assert.strictEqual(responseData.success, true);
        assert.strictEqual(responseData.blocks.length, 0);
    });

    it('Returns fetched blocks', async () => {
        const encrypted = encryptPrivatePayload(keys.publicKey, { files: [{ path: 'test.txt' }] });
        mockNode.ledger.collection.find.mock.mockImplementationOnce(() => ({
            sort: () => ({ toArray: async () => [{ metadata: { index: 1, timestamp: 0 }, hash: 'hash1', previousHash: 'prev', publicKey: 'testPubKey', payload: encrypted, type: 'STORAGE_CONTRACT', signature: 'sig' }] })
        }));

        const handler = new BlocksHandler(mockNode);
        await handler.handle(req, res);
        
        const responseData = res.body;
        assert.strictEqual(responseData.blocks.length, 1);
        assert.strictEqual(responseData.blocks[0].hash, 'hash1');
    });

    it('Filters by local queries', async () => {
        const encryptedMatch = encryptPrivatePayload(keys.publicKey, { files: [{ path: 'match-this.txt' }] });
        const encryptedNoMatch = encryptPrivatePayload(keys.publicKey, { files: [{ path: 'other.txt' }] });
        mockNode.ledger.collection.find.mock.mockImplementationOnce(() => ({
            sort: () => ({ toArray: async () => [
                { metadata: { index: 1, timestamp: 0 }, hash: 'hash1', previousHash: 'prev', publicKey: 'testPubKey', payload: encryptedMatch, type: 'STORAGE_CONTRACT', signature: 'sig1' },
                { metadata: { index: 2, timestamp: 0 }, hash: 'hash2', previousHash: 'prev', publicKey: 'testPubKey', payload: encryptedNoMatch, type: 'STORAGE_CONTRACT', signature: 'sig2' }
            ]})
        }));

        req.query.q = 'match';
        
        const handler = new BlocksHandler(mockNode);
        await handler.handle(req, res);
        
        const responseData = res.body;
        assert.strictEqual(responseData.blocks.length, 1);
        assert.strictEqual(responseData.blocks[0].hash, 'hash1');
    });
    
    it('Appends pending blocks', async () => {
        const encrypted = encryptPrivatePayload(keys.publicKey, { files: [{ path: 'pending.txt' }] });
        mockNode.mempool.pendingBlocks.set('some-sig', createValidPendingBlock('some-sig', 'testPubKey', encrypted, 12345));

        const handler = new BlocksHandler(mockNode);
        await handler.handle(req, res);

        const responseData = res.body;
        assert.strictEqual(responseData.blocks.length, 1);
        assert.strictEqual(responseData.blocks[0].metadata.index, -1);
    });

    it('Returns 500 error on failure', async () => {
        const handler = new BlocksHandler(null as any); // Cannot avoid testing actual null boundary here easily without bypassing TS
        await handler.handle(req, res);
        assert.strictEqual(res.statusCode, 500);
        const responseData = res.body;
        assert.strictEqual(responseData.success, false);
    });

    it('Filters by own blocks', async () => {
        const encrypted = encryptPrivatePayload(keys.publicKey, { files: [{ path: 'test.txt' }] });
        
        mockNode.mempool.pendingBlocks.set('some-sig', createValidPendingBlock('some-sig', 'otherKey', encrypted, 12345));
        mockNode.mempool.pendingBlocks.set('some-sig2', createValidPendingBlock('some-sig2', 'testPubKey', encrypted, 123456));

        req.query.own = 'true';

        const handler = new BlocksHandler(mockNode);
        await handler.handle(req, res);
        
        const responseData = res.body;
        // Only the pending block with testPubKey should be returned
        assert.strictEqual(responseData.blocks.length, 1);
        assert.strictEqual(responseData.blocks[0].publicKey, 'testPubKey');
    });

    it('Sorts pending blocks in ASC and DESC', async () => {
        const encrypted = encryptPrivatePayload(keys.publicKey, { files: [{ path: 'test.txt' }] });
        
        mockNode.mempool.pendingBlocks.set('block1', createValidPendingBlock('b1', 'testPubKey', encrypted, 1000));
        mockNode.mempool.pendingBlocks.set('block2', createValidPendingBlock('b2', 'testPubKey', encrypted, 2000));

        // Test ASC
        req.query.sort = 'asc';
        let handler = new BlocksHandler(mockNode);
        await handler.handle(req, res);
        let resp = res.body;
        assert.strictEqual(resp.blocks[0].signature, 'b1');
        assert.strictEqual(resp.blocks[1].signature, 'b2');

        // Test DESC
        res = createRes();
        req.query.sort = 'desc';
        handler = new BlocksHandler(mockNode);
        await handler.handle(req, res);
        resp = res.body;
        assert.strictEqual(resp.blocks[0].signature, 'b2');
        assert.strictEqual(resp.blocks[1].signature, 'b1');
    });

    it('Catches decryption errors', async () => {
        const encryptedMatch = encryptPrivatePayload(keys.publicKey, { files: [{ path: 'match-this.txt' }] });
        mockNode.ledger.collection.find.mock.mockImplementationOnce(() => ({
            sort: () => ({ toArray: async () => [
                { metadata: { index: 1, timestamp: 0 }, hash: 'hash1', previousHash: 'prev', publicKey: 'testPubKey', payload: encryptPrivatePayload(keys.publicKey, { physicalId: 'pid', location: { type: 'local' }, aesKey: '', aesIv: '', files: [] }), type: 'STORAGE_CONTRACT', signature: 'sig1' },
                { metadata: { index: 2, timestamp: 0 }, hash: 'hash2', previousHash: 'prev', publicKey: 'testPubKey', payload: encryptedMatch, type: 'STORAGE_CONTRACT', signature: 'sig2' }
            ]})
        }));

        req.query.q = 'match';
        const handler = new BlocksHandler(mockNode);
        await handler.handle(req, res);
        
        const responseData = res.body;
        assert.strictEqual(responseData.blocks.length, 1);
        assert.strictEqual(responseData.blocks[0].hash, 'hash2');
    });
});
