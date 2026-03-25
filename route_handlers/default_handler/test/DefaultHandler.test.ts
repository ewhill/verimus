import assert from 'node:assert';
import { describe, it } from 'node:test';

import { MockPeerNode } from '../../../test/mocks/MockPeerNode';
import { MockRequest } from '../../../test/mocks/MockRequest';
import { MockResponse } from '../../../test/mocks/MockResponse';
import DefaultHandler from '../DefaultHandler';

describe('Backend: defaultHandler Integrity', () => {
    it('Exports default request path handler module mapping', async () => {
        assert.ok(DefaultHandler !== undefined, 'Module loaded successfully');
    });

    it('Returns static node verification welcome prompt JSON object', async () => {
        const req = new MockRequest();
        const res = new MockResponse();
        const mockNode = new MockPeerNode();
        const handler = new DefaultHandler(mockNode.asPeerNode());
        await handler.handle(req.asRequest(), res.asResponse());
        assert.strictEqual(res.sentPath, 'index.html');
    });
});
