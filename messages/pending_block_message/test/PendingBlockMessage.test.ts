import assert from 'node:assert';
import { describe, it } from 'node:test';

import type { Block } from '../../../types';
import { PendingBlockMessage } from '../PendingBlockMessage';

describe('Messages: PendingBlockMessage', () => {

    const mockBlock: Block = {
        type: 'TRANSACTION',
        metadata: { index: 1, timestamp: 123 },
        signerAddress: 'PK',
        payload: { senderSignature: 'sig', senderAddress: 's1', recipientAddress: 'r1', amount: 100 },
        signature: 'SIG',
        previousHash: 'PREV'
    };

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
