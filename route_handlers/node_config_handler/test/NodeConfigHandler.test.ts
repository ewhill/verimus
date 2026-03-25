import assert from 'node:assert';
import { describe, it } from 'node:test';

import { MockPeerNode } from '../../../test/mocks/MockPeerNode';
import { MockRequest } from '../../../test/mocks/MockRequest';
import { MockResponse } from '../../../test/mocks/MockResponse';
import nodeConfigHandler from '../NodeConfigHandler';

describe('Backend: nodeConfigHandler Integrity', () => {
    it('Responds with active node configuration parameters globally', async () => {
        const req = new MockRequest();
        const res = new MockResponse();
        const mockNode = new MockPeerNode({ publicKey: 'pub', signature: 'sig', port: 1234 });
        const handler = new nodeConfigHandler(mockNode.asPeerNode());
        await handler.handle(req.asRequest(), res.asResponse());
        
        const data = res.body;
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.publicKey, 'pub');
        assert.strictEqual(data.signature, 'sig');
        assert.strictEqual(data.port, 1234);
    });
});
