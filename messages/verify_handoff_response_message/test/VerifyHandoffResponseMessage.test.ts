import assert from 'node:assert';
import { describe, it } from 'node:test';

import { VerifyHandoffResponseMessage } from '../VerifyHandoffResponseMessage';

describe('Messages: VerifyHandoffResponseMessage Definitions', () => {

    it('Initializes with direct options properties correctly', () => {
        const msg = new VerifyHandoffResponseMessage({
            marketId: 'market123',
            physicalId: 'physA',
            targetChunkIndex: 5,
            chunkDataBase64: 'ZGF0YTEyMw==',
            merkleSiblings: ['hash1', 'hash2'],
            success: true
        });

        assert.strictEqual(msg.marketId, 'market123');
        assert.strictEqual(msg.physicalId, 'physA');
        assert.strictEqual(msg.targetChunkIndex, 5);
        assert.strictEqual(msg.chunkDataBase64, 'ZGF0YTEyMw==');
        assert.deepStrictEqual(msg.merkleSiblings, ['hash1', 'hash2']);
        assert.strictEqual(msg.success, true);
    });

    it('Initializes via nested payload properties', () => {
        const msg = new VerifyHandoffResponseMessage({
            body: {
                marketId: 'market456',
                physicalId: 'physB',
                targetChunkIndex: 8,
                chunkDataBase64: 'ZGF0YTM0NQ==',
                merkleSiblings: ['hash3'],
                success: false
            }
        });

        assert.strictEqual(msg.marketId, 'market456');
        assert.strictEqual(msg.physicalId, 'physB');
        assert.strictEqual(msg.targetChunkIndex, 8);
        assert.strictEqual(msg.chunkDataBase64, 'ZGF0YTM0NQ==');
        assert.deepStrictEqual(msg.merkleSiblings, ['hash3']);
        assert.strictEqual(msg.success, false);
    });

    it('Mutates structured data payloads supporting dynamic setters', () => {
        const msg = new VerifyHandoffResponseMessage();
        
        msg.marketId = 'dynamic_market';
        msg.physicalId = 'dyn_physical';
        msg.targetChunkIndex = 99;
        msg.chunkDataBase64 = 'ZGF0YTk5OQ==';
        msg.merkleSiblings = ['hash4', 'hash5'];
        msg.success = true;

        assert.strictEqual(msg.marketId, 'dynamic_market');
        assert.strictEqual(msg.physicalId, 'dyn_physical');
        assert.strictEqual(msg.targetChunkIndex, 99);
        assert.strictEqual(msg.chunkDataBase64, 'ZGF0YTk5OQ==');
        assert.deepStrictEqual(msg.merkleSiblings, ['hash4', 'hash5']);
        assert.strictEqual(msg.success, true);
    });
});
