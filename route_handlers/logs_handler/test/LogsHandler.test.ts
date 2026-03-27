import assert from 'node:assert';
import { describe, it, mock } from 'node:test';

import type { Request, Response } from 'express';

import logger from '../../../logger/Logger';
import type PeerNode from '../../../peer_node/PeerNode';
import LogsHandler from '../LogsHandler';

function createRes(): Partial<Response> & { body?: any } {
    const res: Partial<Response> & { body?: any } = { statusCode: 200, body: null };
    res.status = function(code: number) { this.statusCode = code; return this as Response; };
    res.json = function(data: any) { this.body = data; return this as Response; };
    res.send = function(data: any) { this.body = data; return this as Response; };
    return res;
}

describe('Backend: logsHandler Integrity', () => {
    it('Parses local winston logfile returning ordered output mapping', async () => {
        const req = {} as unknown as Request;
        const res = createRes();
        const mockNode: Partial<PeerNode> = {};
        const handler = new LogsHandler(mockNode as PeerNode);
        await handler.handle(req as Request, res as Response);
        const data = res.body;
        assert.ok(Array.isArray(data));
    });

    it('Handles missing logfiles correctly returning fallback failure JSON', async () => {
        const req = {} as unknown as Request;
        const res = createRes();
        const mockNode: Partial<PeerNode> = {};

        // Stub logger.getLogs to throw natively
        mock.method(logger, 'getLogs', () => { throw new Error('test error'); });
        
        const handler = new LogsHandler(mockNode as PeerNode);
        await handler.handle(req as Request, res as Response);
        mock.restoreAll();
        
        assert.strictEqual(res.statusCode, 500);
        const data = res.body;
        assert.strictEqual(data.success, false);
        assert.strictEqual(data.message, 'test error');
    });
});
