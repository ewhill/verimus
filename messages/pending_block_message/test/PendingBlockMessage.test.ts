import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PendingBlockMessage } from '../PendingBlockMessage';
import type { Block } from '../../../types';

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

    it('Initializes via nested payload properties seamlessly', () => {
        const msg = new PendingBlockMessage({ body: { block: mockBlock } });
        assert.deepEqual(msg.block, mockBlock);
    });

    it('Updates attributes accurately leveraging class dynamic setters', () => {
        const msg = new PendingBlockMessage();
        msg.block = mockBlock;
        assert.deepEqual(msg.block, mockBlock);
        assert.deepEqual(msg.body.block, mockBlock);
    });

});
