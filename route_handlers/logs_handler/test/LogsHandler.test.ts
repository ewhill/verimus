import { describe, it } from 'node:test';
import assert from 'node:assert';
import logsHandler from '../LogsHandler';
import logger from '../../../logger/Logger';

describe('Backend: logsHandler Integrity', () => {
    it('Parses local winston logfile returning ordered output mapping', async () => {
        let jsonStr = '';
        const req = {};
        const res = {
            json(data: any) { jsonStr = JSON.stringify(data); return this; },
        };
        const handler = new logsHandler({} as any);
        await handler.handle(req as any, res as any);
        const data = JSON.parse(jsonStr);
        assert.ok(Array.isArray(data));
    });

    it('Handles missing logfiles correctly returning fallback failure JSON', async () => {
        let jsonStr = ''; let statusObj = 200;
        const req = {};
        const res = {
            status(s: number) { statusObj = s; return this; },
            json(data: any) { jsonStr = JSON.stringify(data); return this; },
        };
        // Stub logger.getLogs to throw
        const oldGetLogs = logger.getLogs;
        logger.getLogs = () => { throw new Error('test error'); };
        
        const handler = new logsHandler({} as any);
        await handler.handle(req as any, res as any);
        
        logger.getLogs = oldGetLogs; // restore
        
        assert.strictEqual(statusObj, 500);
        const data = JSON.parse(jsonStr);
        assert.strictEqual(data.success, false);
        assert.strictEqual(data.message, 'test error');
    });
});
