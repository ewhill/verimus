import assert from 'node:assert';
import { test, describe } from 'node:test';

import { StorageShardResponseMessage } from '../StorageShardResponseMessage';

describe('Messages: StorageShardResponseMessage Definitions', () => {
    test('Initializes with direct options properties correctly', () => {
        const msg = new StorageShardResponseMessage({
            marketId: 'market_123',
            shardIndex: 3,
            physicalId: 'phy_test',
            success: true
        });

        assert.strictEqual(msg.marketId, 'market_123');
        assert.strictEqual(msg.shardIndex, 3);
        assert.strictEqual(msg.physicalId, 'phy_test');
        assert.strictEqual(msg.success, true);
    });

    test('Initializes via nested payload properties', () => {
        const msg = new StorageShardResponseMessage({
            body: {
                marketId: 'market_999',
                shardIndex: 5,
                physicalId: 'phy_999',
                success: false
            }
        });

        assert.strictEqual(msg.marketId, 'market_999');
        assert.strictEqual(msg.shardIndex, 5);
        assert.strictEqual(msg.physicalId, 'phy_999');
        assert.strictEqual(msg.success, false);
    });

    test('Mutates structured data payloads supporting dynamic setters', () => {
        const msg = new StorageShardResponseMessage({});
        
        msg.marketId = 'market_updated';
        msg.shardIndex = 7;
        msg.physicalId = 'phy_updated';
        msg.success = true;

        assert.strictEqual(msg.body.marketId, 'market_updated');
        assert.strictEqual(msg.body.shardIndex, 7);
        assert.strictEqual(msg.body.physicalId, 'phy_updated');
        assert.strictEqual(msg.body.success, true);
    });
});
