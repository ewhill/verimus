import assert from 'node:assert';
import { describe, it } from 'node:test';

import Mempool from '../Mempool';

describe('Backend: Mempool Integrity', () => {
    it('Exports Mempool singleton', async () => {
        assert.ok(Mempool !== undefined, 'Module loaded successfully');
    });
});
