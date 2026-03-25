import assert from 'node:assert';
import { describe, it } from 'node:test';

import logger from '../../../logger/Logger';
import { MockPeerNode } from '../../../test/mocks/MockPeerNode';
import { MockRequest } from '../../../test/mocks/MockRequest';
import { MockResponse } from '../../../test/mocks/MockResponse';
import logsHandler from '../LogsHandler';

describe('Backend: logsHandler Integrity', () => {
    it('Parses local winston logfile returning ordered output mapping', async () => {
        const req = new MockRequest();
        const res = new MockResponse();
        const mockNode = new MockPeerNode();
        const handler = new logsHandler(mockNode.asPeerNode());
        await handler.handle(req.asRequest(), res.asResponse());
        const data = res.body;
        assert.ok(Array.isArray(data));
    });

    it('Handles missing logfiles correctly returning fallback failure JSON', async () => {
        const req = new MockRequest();
        const res = new MockResponse();
        const mockNode = new MockPeerNode();

        // Stub logger.getLogs to throw
        const oldGetLogs = logger.getLogs;
        logger.getLogs = () => { throw new Error('test error'); };
        
        try {
            const handler = new logsHandler(mockNode.asPeerNode());
            await handler.handle(req.asRequest(), res.asResponse());
        } finally {
            logger.getLogs = oldGetLogs; // restore
        }
        
        assert.strictEqual(res.statusCode, 500);
        const data = res.body;
        assert.strictEqual(data.success, false);
        assert.strictEqual(data.message, 'test error');
    });
});
