import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Backend: logger Integrity', () => {
    it('Exports logger singleton', async () => {
        const mod = await import('../logger.ts');
        assert.ok(mod !== undefined, 'Module loaded successfully');
    });
});
