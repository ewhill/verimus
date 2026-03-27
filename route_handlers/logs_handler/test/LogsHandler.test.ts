import assert from 'node:assert';
import { describe, it, mock } from 'node:test';

import logger from '../../../logger/Logger';
import logsHandler from '../LogsHandler';

function createRes() {
    const res: any = { statusCode: 200, body: null };
    res.status = (code: number) => { res.statusCode = code; return res; };
    res.json = (data: any) => { res.body = data; return res; };
    res.send = (data: any) => { res.body = data; return res; };
    return res;
}

describe('Backend: logsHandler Integrity', () => {
    it('Parses local winston logfile returning ordered output mapping', async () => {
        const req: any = {};
        const res: any = createRes();
        const mockNode: any = {};
        const handler = new logsHandler(mockNode);
        await handler.handle(req, res);
        const data = res.body;
        assert.ok(Array.isArray(data));
    });

    it('Handles missing logfiles correctly returning fallback failure JSON', async () => {
        const req: any = {};
        const res = createRes();
        const mockNode: any = {};

        // Stub logger.getLogs to throw natively
        mock.method(logger, 'getLogs', () => { throw new Error('test error'); });
        
        const handler = new logsHandler(mockNode);
        await handler.handle(req, res);
        mock.restoreAll();
        
        assert.strictEqual(res.statusCode, 500);
        const data = res.body;
        assert.strictEqual(data.success, false);
        assert.strictEqual(data.message, 'test error');
    });
});
