import assert from 'node:assert';
import { describe, it, mock } from 'node:test';

import { Request, Response } from 'express';

import logger from '../../../logger/Logger';
import type PeerNode from '../../../peer_node/PeerNode';
import { createMock } from '../../../test/utils/TestUtils';
import LogsHandler from '../LogsHandler';

describe('Backend: logsHandler Integrity', () => {
    it('Parses local winston logfile returning ordered output mapping', async () => {
        const mockRequest = createMock<Request>({});
        let mockResponseObj: Response;
        const mockResponseStatus = mock.fn<(_unusedCode: number) => Response>((_unusedCode: number) => mockResponseObj);
        const mockResponseJson = mock.fn<(_unusedBody?: any) => Response>((_unusedBody?: any) => mockResponseObj);
        mockResponseObj = createMock<Response>({ 
            status: mockResponseStatus,
            json: mockResponseJson,
            send: mockResponseJson
        });
        const mockNode = createMock<PeerNode>({});
        const handler = new LogsHandler(mockNode);
        await handler.handle(mockRequest, mockResponseObj);

        assert.strictEqual(mockResponseJson.mock.calls.length, 1);
        const data = mockResponseJson.mock.calls.pop()?.arguments[0];
        assert.ok(Array.isArray(data));
    });

    it('Handles missing logfiles correctly returning fallback failure JSON', async () => {
        const mockRequest = createMock<Request>({});
        let mockResponseObj: Response;
        const mockResponseStatus = mock.fn<(_unusedCode: number) => Response>((_unusedCode: number) => mockResponseObj);
        const mockResponseJson = mock.fn<(_unusedBody?: any) => Response>((_unusedBody?: any) => mockResponseObj);
        mockResponseObj = createMock<Response>({ 
            status: mockResponseStatus,
            json: mockResponseJson,
            send: mockResponseJson
        });
        const mockNode = createMock<PeerNode>({});

        // Stub logger.getLogs to throw natively
        mock.method(logger, 'getLogs', () => { throw new Error('test error'); });
        
        const handler = new LogsHandler(mockNode);
        await handler.handle(mockRequest, mockResponseObj);
        mock.restoreAll();
        
        assert.strictEqual(mockResponseStatus.mock.calls.length, 1);
        assert.strictEqual(mockResponseStatus.mock.calls.pop()?.arguments[0], 500);

        assert.strictEqual(mockResponseJson.mock.calls.length, 1);
        const data = mockResponseJson.mock.calls.pop()?.arguments[0];
        assert.strictEqual(data.success, false);
        assert.strictEqual(data.message, 'test error');
    });
});
