import assert from 'node:assert';
import { describe, it } from 'node:test';

import { VerifyHandoffResponseMessage } from '../VerifyHandoffResponseMessage';

describe('Messages: VerifyHandoffResponseMessage Definitions', () => {

    it('Initializes with direct options properties correctly', () => {
        const msg = new VerifyHandoffResponseMessage({
            marketId: 'market123',
            physicalId: 'phys123',
            targetChunkIndex: 2,
            chunkHashBase64: 'abc123hash',
            success: true
        });

        assert.strictEqual(msg.marketId, 'market123');
        assert.strictEqual(msg.physicalId, 'phys123');
        assert.strictEqual(msg.targetChunkIndex, 2);
        assert.strictEqual(msg.chunkHashBase64, 'abc123hash');
        assert.strictEqual(msg.success, true);
    });

    it('Initializes via nested payload properties', () => {
        const msg = new VerifyHandoffResponseMessage({
            body: {
                marketId: 'market456',
                physicalId: 'phys456',
                targetChunkIndex: 9,
                chunkHashBase64: 'failinghash',
                success: false
            }
        });

        assert.strictEqual(msg.marketId, 'market456');
        assert.strictEqual(msg.physicalId, 'phys456');
        assert.strictEqual(msg.targetChunkIndex, 9);
        assert.strictEqual(msg.chunkHashBase64, 'failinghash');
        assert.strictEqual(msg.success, false);
    });

    it('Mutates structured data payloads supporting dynamic setters', () => {
        const msg = new VerifyHandoffResponseMessage();
        
        msg.marketId = 'set_market';
        msg.physicalId = 'set_phys';
        msg.targetChunkIndex = 4;
        msg.chunkHashBase64 = 'some_base64_hash';
        msg.success = true;

        assert.strictEqual(msg.marketId, 'set_market');
        assert.strictEqual(msg.physicalId, 'set_phys');
        assert.strictEqual(msg.targetChunkIndex, 4);
        assert.strictEqual(msg.chunkHashBase64, 'some_base64_hash');
        assert.strictEqual(msg.success, true);
    });
});
