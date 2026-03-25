import assert from 'node:assert';
import { test, describe } from 'node:test';

import { StorageShardTransferMessage } from '../StorageShardTransferMessage';

describe('Messages: StorageShardTransferMessage Definitions', () => {
    test('Initializes with direct options properties correctly', () => {
        const msg = new StorageShardTransferMessage({
            marketId: 'market_123',
            shardIndex: 3,
            shardDataBase64: 'base64_data_here'
        });

        assert.strictEqual(msg.marketId, 'market_123');
        assert.strictEqual(msg.shardIndex, 3);
        assert.strictEqual(msg.shardDataBase64, 'base64_data_here');
    });

    test('Initializes via nested payload properties', () => {
        const msg = new StorageShardTransferMessage({
            body: {
                marketId: 'market_999',
                shardIndex: 5,
                shardDataBase64: 'base64_data_again'
            }
        });

        assert.strictEqual(msg.marketId, 'market_999');
        assert.strictEqual(msg.shardIndex, 5);
        assert.strictEqual(msg.shardDataBase64, 'base64_data_again');
    });

    test('Mutates structured data payloads supporting dynamic setters', () => {
        const msg = new StorageShardTransferMessage({});
        
        msg.marketId = 'market_updated';
        msg.shardIndex = 7;
        msg.shardDataBase64 = 'updated_data_base64';

        assert.strictEqual(msg.body.marketId, 'market_updated');
        assert.strictEqual(msg.body.shardIndex, 7);
        assert.strictEqual(msg.body.shardDataBase64, 'updated_data_base64');
    });
});
