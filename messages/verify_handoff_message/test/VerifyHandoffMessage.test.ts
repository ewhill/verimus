import assert from 'node:assert';
import { describe, it } from 'node:test';

import { VerifyHandoffMessage } from '../VerifyHandoffMessage';

describe('Messages: VerifyHandoffMessage Definitions', () => {

    it('Initializes with direct options properties correctly', () => {
        const msg = new VerifyHandoffMessage({
            marketId: 'market123',
            physicalId: 'physA',
            targetChunkIndex: 5
        });

        assert.strictEqual(msg.marketId, 'market123');
        assert.strictEqual(msg.physicalId, 'physA');
        assert.strictEqual(msg.targetChunkIndex, 5);
        assert.strictEqual(msg.body.marketId, 'market123');
        assert.strictEqual(msg.body.targetChunkIndex, 5);
    });

    it('Initializes via nested payload properties', () => {
        const msg = new VerifyHandoffMessage({
            body: {
                marketId: 'market456',
                physicalId: 'physB',
                targetChunkIndex: 12
            }
        });

        assert.strictEqual(msg.marketId, 'market456');
        assert.strictEqual(msg.physicalId, 'physB');
        assert.strictEqual(msg.targetChunkIndex, 12);
    });

    it('Mutates structured data payloads supporting dynamic setters', () => {
        const msg = new VerifyHandoffMessage();
        
        msg.marketId = 'dynamic_market';
        msg.physicalId = 'dyn_physical';
        msg.targetChunkIndex = 0;

        assert.strictEqual(msg.marketId, 'dynamic_market');
        assert.strictEqual(msg.physicalId, 'dyn_physical');
        assert.strictEqual(msg.targetChunkIndex, 0);
        assert.strictEqual(msg.body.marketId, 'dynamic_market');
    });
});
