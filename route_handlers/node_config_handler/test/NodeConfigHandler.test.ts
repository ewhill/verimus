import assert from 'node:assert';
import { describe, it, mock } from 'node:test';

import { Request, Response } from 'express';

import type PeerNode from '../../../peer_node/PeerNode';
import { createMock } from '../../../test/utils/TestUtils';
import nodeConfigHandler from '../NodeConfigHandler';

describe('Backend: nodeConfigHandler Integrity', () => {
    it('Responds with active node configuration parameters globally', async () => {
        const req = createMock<Request>({});
        const mockStatus = mock.fn(function() { return res; }) as import('node:test').Mock<any>;
        const mockJson = mock.fn(function() { return res; }) as import('node:test').Mock<any>;
        const res = createMock<Response>({
            status: mockStatus as any,
            json: mockJson as any
        });
        
        const mockNode = createMock<PeerNode>({ publicKey: 'pub', signature: 'sig', port: 1234 });
        const handler = new nodeConfigHandler(mockNode);
        await handler.handle(req, res);
        
        const data = mockJson.mock.calls[0].arguments[0];
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.publicKey, 'pub');
        assert.strictEqual(data.signature, 'sig');
        assert.strictEqual(data.port, 1234);
    });
});
