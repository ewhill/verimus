import assert from 'node:assert';
import { describe, it, mock } from 'node:test';

import { Request, Response } from 'express';

import type PeerNode from '../../../peer_node/PeerNode';
import { createMock } from '../../../test/utils/TestUtils';
import { NodeRole } from '../../../types/NodeRole';
import NodeConfigHandler from '../NodeConfigHandler';

describe('Backend: nodeConfigHandler Integrity', () => {
    it('Responds with active node configuration parameters globally', async () => {
        const mockPeerNode = createMock<PeerNode>({
            walletAddress: 'pub',
            port: 1234,
            roles: [NodeRole.ORIGINATOR],
            storageProvider: null
        });
        const mockRequest = createMock<Request>({});
        let mockResponse: Response;
        const mockResponseJson = mock.fn<(_unusedBody?: any) => Response>((_unusedBody?: any) => mockResponse);
        mockResponse = createMock<Response>({ json: mockResponseJson });
        const handler = new NodeConfigHandler(mockPeerNode);

        await handler.handle(mockRequest, mockResponse);

        assert.strictEqual(mockResponseJson.mock.calls.length, 1);
        const data = mockResponseJson.mock.calls.pop()?.arguments[0];
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.publicKey, 'pub');
        assert.strictEqual(data.port, 1234);
    });
});
