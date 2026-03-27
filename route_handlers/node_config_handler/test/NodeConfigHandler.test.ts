import assert from 'node:assert';
import { describe, it } from 'node:test';

import nodeConfigHandler from '../NodeConfigHandler';

function createRes() {
    const res: any = { statusCode: 200, body: null };
    res.status = (code: number) => { res.statusCode = code; return res; };
    res.json = (data: any) => { res.body = data; return res; };
    res.send = (data: any) => { res.body = data; return res; };
    return res;
}

describe('Backend: nodeConfigHandler Integrity', () => {
    it('Responds with active node configuration parameters globally', async () => {
        const req: any = {};
        const res: any = createRes();
        const mockNode: any = { publicKey: 'pub', signature: 'sig', port: 1234 };
        const handler = new nodeConfigHandler(mockNode);
        await handler.handle(req, res);
        
        const data = res.body;
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.publicKey, 'pub');
        assert.strictEqual(data.signature, 'sig');
        assert.strictEqual(data.port, 1234);
    });
});
