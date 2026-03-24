import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ChainStatusRequestMessage } from '../ChainStatusRequestMessage';

describe('Messages: ChainStatusRequestMessage', () => {
    it('Instantiates accurately as an empty boundary ping message', () => {
        const msg = new ChainStatusRequestMessage();
        assert.ok(msg);
        assert.ok(msg.header);
    });
});
