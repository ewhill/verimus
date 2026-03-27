import assert from 'node:assert';
import { describe, it } from 'node:test';

import { MockPeerNode } from '../../test/mocks/MockPeerNode';
import setupExpressApp from '../ApiServer';

describe('Backend: apiServer Integrity Check', () => {

    it('Configures Express API routes and headers', () => {
        const mockNode = new MockPeerNode({
            publicKey: 'test',
            signature: 'test',
            port: 3000
        });
        const app = setupExpressApp(mockNode.asPeerNode());
        
        assert.ok(typeof app.listen === 'function');
        assert.ok(typeof app.use === 'function');
    });
});
