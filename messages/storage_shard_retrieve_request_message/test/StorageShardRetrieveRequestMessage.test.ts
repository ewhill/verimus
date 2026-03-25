import assert from 'node:assert';
import { test, describe } from 'node:test';

import { StorageShardRetrieveRequestMessage } from '../StorageShardRetrieveRequestMessage';

describe('Messages: StorageShardRetrieveRequestMessage Definitions', () => {
    test('Initializes with direct options properties correctly', () => {
        const msg = new StorageShardRetrieveRequestMessage({
            physicalId: 'phy_test',
            marketId: 'market_123'
        });

        assert.strictEqual(msg.physicalId, 'phy_test');
        assert.strictEqual(msg.marketId, 'market_123');
    });

    test('Initializes via nested payload properties', () => {
        const msg = new StorageShardRetrieveRequestMessage({
            body: {
                physicalId: 'phy_999',
                marketId: 'market_999'
            }
        });

        assert.strictEqual(msg.physicalId, 'phy_999');
        assert.strictEqual(msg.marketId, 'market_999');
    });

    test('Mutates structured data payloads supporting dynamic setters', () => {
        const msg = new StorageShardRetrieveRequestMessage({});
        
        msg.physicalId = 'phy_updated';
        msg.marketId = 'market_updated';

        assert.strictEqual(msg.body.physicalId, 'phy_updated');
        assert.strictEqual(msg.body.marketId, 'market_updated');
    });
});
