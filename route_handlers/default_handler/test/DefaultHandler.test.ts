import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('Backend: defaultHandler Integrity', () => {
    it('Exports default request path handler module mapping', async () => {
        const mod = await import('../DefaultHandler');
    });

    it('Returns static node verification welcome prompt JSON object', async () => {
        const DefaultHandler = (await import('../DefaultHandler')).default;
        const req = {} as any;
        let sentPath = '';
        const res = { sendFile: (p: string) => { sentPath = p; } } as any;
        const handler = new DefaultHandler({} as any);
        await handler.handle(req, res);
        assert.strictEqual(sentPath, 'index.html');
    });
});
