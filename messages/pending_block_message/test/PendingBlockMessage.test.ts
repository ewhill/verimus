import assert from 'node:assert';
import { describe, it } from 'node:test';

import type { Block } from '../../../types';
import { PendingBlockMessage } from '../PendingBlockMessage';

describe('Messages: PendingBlockMessage', () => {

    const mockBlock: Block = {
        type: 'TRANSACTION',
        metadata: { index: 1, timestamp: 123 },
        publicKey: 'PK',
        payload: { test: true },
        signature: 'SIG',
        previousHash: 'PREV'
    } as any;

    it('Initializes with direct options properties correctly', () => {
        const msg = new PendingBlockMessage({ block: mockBlock });
        assert.deepEqual(msg.block, mockBlock);
    });

    it('Initializes via nested payload properties', () => {
        const msg = new PendingBlockMessage({ body: { block: mockBlock } });
        assert.deepEqual(msg.block, mockBlock);
    });

    it('Updates attributes leveraging class dynamic setters', () => {
        const msg = new PendingBlockMessage();
        msg.block = mockBlock;
        assert.deepEqual(msg.block, mockBlock);
        assert.deepEqual(msg.body.block, mockBlock);
    });

});
