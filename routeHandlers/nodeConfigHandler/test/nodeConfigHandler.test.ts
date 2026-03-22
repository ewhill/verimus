import { describe, it } from 'node:test';
import assert from 'node:assert';
import nodeConfigHandler from '../nodeConfigHandler';

describe('Backend: nodeConfigHandler Integrity', () => {
    it('Responds with active node configuration parameters globally', async () => {
        let jsonStr = '';
        const req = {};
        const res = { json(data: any) { jsonStr = JSON.stringify(data); return this; } };
        const node = { publicKey: 'pub', signature: 'sig', port: 1234 };
        const handler = new nodeConfigHandler(node as any);
        await handler.handle(req as any, res as any);
        
        const data = JSON.parse(jsonStr);
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.publicKey, 'pub');
        assert.strictEqual(data.signature, 'sig');
        assert.strictEqual(data.port, 1234);
    });
});
