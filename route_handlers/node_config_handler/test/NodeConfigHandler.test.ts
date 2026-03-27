import assert from 'node:assert';
import { describe, it } from 'node:test';

import { Request } from 'express';

import type PeerNode from '../../../peer_node/PeerNode';
import { createMock, createRes } from '../../../test/utils/TestUtils';
import nodeConfigHandler from '../NodeConfigHandler';

describe('Backend: nodeConfigHandler Integrity', () => {
    it('Responds with active node configuration parameters globally', async () => {
        const req = createMock<Request>({});
        const res = createRes();
        const mockNode = createMock<PeerNode>({ publicKey: 'pub', signature: 'sig', port: 1234 });
        const handler = new nodeConfigHandler(mockNode);
        await handler.handle(req, res);
        
        const data = res.body;
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.publicKey, 'pub');
        assert.strictEqual(data.signature, 'sig');
        assert.strictEqual(data.port, 1234);
    });
});
