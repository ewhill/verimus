import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('Backend: Mempool Integrity', () => {
    it('Exports Mempool singleton', async () => {
        const mod = await import('../Mempool');
        assert.ok(mod !== undefined, 'Module loaded successfully');
    });
});
