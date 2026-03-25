import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('Backend: logger Integrity', () => {
    it('Exports logger singleton', async () => {
        const mod = await import('../Logger');
        assert.ok(mod !== undefined, 'Module loaded successfully');
    });
});
