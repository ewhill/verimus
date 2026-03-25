import assert from 'node:assert';
import { describe, it } from 'node:test';

import { BlockSyncRequestMessage } from '../BlockSyncRequestMessage';

describe('Messages: BlockSyncRequestMessage', () => {

    it('Initializes with direct options properties correctly', () => {
        const msg = new BlockSyncRequestMessage({ index: 5 });
        assert.strictEqual(msg.index, 5);
    });

    it('Initializes via nested payload properties', () => {
        const msg = new BlockSyncRequestMessage({ body: { index: 10 } });
        assert.strictEqual(msg.index, 10);
    });

    it('Updates attributes leveraging class dynamic setters', () => {
        const msg = new BlockSyncRequestMessage();
        msg.index = 15;
        assert.strictEqual(msg.index, 15);
        assert.strictEqual(msg.body.index, 15);
    });

});
