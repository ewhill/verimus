import assert from 'node:assert';
import { describe, it } from 'node:test';

import type { Block } from '../../../types';
import { createMock } from '../../../test/utils/TestUtils';
import { BlockSyncResponseMessage } from '../BlockSyncResponseMessage';

describe('Messages: BlockSyncResponseMessage', () => {

    const mockBlock: Block = {
        type: 'TRANSACTION',
        metadata: { index: 1, timestamp: 123 },
        signerAddress: 'PK',
        payload: { senderSignature: 'sig', senderAddress: 's1', recipientAddress: 'r1', amount: 100n },
        signature: 'SIG',
        previousHash: 'PREV'
    };

    it('Initializes with direct options properties correctly', () => {
        const msg = new BlockSyncResponseMessage({ block: mockBlock });
        assert.deepEqual(msg.block, mockBlock);
    });

    it('Initializes via nested payload properties', () => {
        const msg = new BlockSyncResponseMessage({ body: { block: mockBlock } });
        assert.deepEqual(msg.block, mockBlock);
    });

    it('Updates attributes leveraging class dynamic setters', () => {
        const msg = new BlockSyncResponseMessage();
        msg.block = mockBlock;
        assert.deepEqual(msg.block, mockBlock);
        assert.deepEqual(msg.body.block, mockBlock);
    });

});
