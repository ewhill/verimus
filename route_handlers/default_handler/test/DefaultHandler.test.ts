import assert from 'node:assert';
import { describe, it, mock } from 'node:test';

import DefaultHandler from '../DefaultHandler';

describe('Backend: defaultHandler Integrity', () => {
    it('Exports default request path handler module mapping', async () => {
        assert.ok(DefaultHandler !== undefined, 'Module loaded successfully');
    });

    it('Returns static node verification welcome prompt JSON object', async () => {
        const req: any = {};
        const res: any = { sendFile: mock.fn() };
        const mockNode: any = {};
        const handler = new DefaultHandler(mockNode);
        await handler.handle(req, res);
        assert.strictEqual(res.sendFile.mock.calls[0].arguments[0], 'index.html');
    });
});
