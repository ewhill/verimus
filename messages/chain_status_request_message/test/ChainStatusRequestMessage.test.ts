import assert from 'node:assert';
import { describe, it } from 'node:test';

import { ChainStatusRequestMessage } from '../ChainStatusRequestMessage';

describe('Messages: ChainStatusRequestMessage', () => {
    it('Instantiates as an empty boundary ping message', () => {
        const msg = new ChainStatusRequestMessage();
        assert.ok(msg);
        assert.ok(msg.header);
    });
});
