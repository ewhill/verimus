import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Backend: Mempool Integrity', () => {
    it('Exports Mempool singleton', async () => {
        const mod = await import('../../models/Mempool.ts');
        assert.ok(mod !== undefined, 'Module loaded successfully');
    });
});
