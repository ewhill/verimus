import assert from 'node:assert';
import { test, describe } from 'node:test';

import { StorageShardRetrieveResponseMessage } from '../StorageShardRetrieveResponseMessage';

describe('Messages: StorageShardRetrieveResponseMessage Definitions', () => {
    test('Initializes with direct options properties correctly', () => {
        const msg = new StorageShardRetrieveResponseMessage({
            marketId: 'market_123',
            shardDataBase64: 'base64_data',
            physicalId: 'phy_test',
            success: true
        });

        assert.strictEqual(msg.marketId, 'market_123');
        assert.strictEqual(msg.shardDataBase64, 'base64_data');
        assert.strictEqual(msg.physicalId, 'phy_test');
        assert.strictEqual(msg.success, true);
    });

    test('Initializes via nested payload properties', () => {
        const msg = new StorageShardRetrieveResponseMessage({
            body: {
                marketId: 'market_999',
                shardDataBase64: 'base64_test',
                physicalId: 'phy_999',
                success: false
            }
        });

        assert.strictEqual(msg.marketId, 'market_999');
        assert.strictEqual(msg.shardDataBase64, 'base64_test');
        assert.strictEqual(msg.physicalId, 'phy_999');
        assert.strictEqual(msg.success, false);
    });

    test('Mutates structured data payloads supporting dynamic setters', () => {
        const msg = new StorageShardRetrieveResponseMessage({});
        
        msg.marketId = 'market_updated';
        msg.shardDataBase64 = 'base64_updated';
        msg.physicalId = 'phy_updated';
        msg.success = true;

        assert.strictEqual(msg.body.marketId, 'market_updated');
        assert.strictEqual(msg.body.shardDataBase64, 'base64_updated');
        assert.strictEqual(msg.body.physicalId, 'phy_updated');
        assert.strictEqual(msg.body.success, true);
    });
});
