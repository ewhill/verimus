import assert from 'node:assert';
import { describe, it } from 'node:test';

import { StorageRequestMessage } from '../StorageRequestMessage';

describe('Messages: StorageRequestMessage Definitions', () => {

    it('Initializes with direct options properties correctly', () => {
        const msg = new StorageRequestMessage({
            storageRequestId: 'req-123',
            fileSizeBytes: 1024,
            chunkSizeBytes: 64,
            requiredNodes: 3,
            maxCostPerGB: 0.05,
            senderAddress: 'PUBKEY'
        });

        assert.strictEqual(msg.storageRequestId, 'req-123');
        assert.strictEqual(msg.fileSizeBytes, 1024);
        assert.strictEqual(msg.chunkSizeBytes, 64);
        assert.strictEqual(msg.requiredNodes, 3);
        assert.strictEqual(msg.maxCostPerGB, 0.05);
        assert.strictEqual(msg.senderAddress, 'PUBKEY');
    });

    it('Initializes via nested payload properties', () => {
        const msg = new StorageRequestMessage({
            body: {
                storageRequestId: 'req-ABC',
                fileSizeBytes: 2048,
                chunkSizeBytes: 128,
                requiredNodes: 5,
                maxCostPerGB: 0.1,
                senderAddress: 'PUBKEY2'
            }
        });

        assert.strictEqual(msg.storageRequestId, 'req-ABC');
        assert.strictEqual(msg.fileSizeBytes, 2048);
        assert.strictEqual(msg.chunkSizeBytes, 128);
        assert.strictEqual(msg.requiredNodes, 5);
        assert.strictEqual(msg.maxCostPerGB, 0.1);
        assert.strictEqual(msg.senderAddress, 'PUBKEY2');
    });

    it('Mutates structured data payloads supporting dynamic setters', () => {
        const msg = new StorageRequestMessage();
        msg.senderAddress = 'MOCK_KEY';
        msg.maxCostPerGB = 0.8;
        
        assert.strictEqual(msg.senderAddress, 'MOCK_KEY');
        assert.strictEqual(msg.maxCostPerGB, 0.8);
        assert.strictEqual(msg.body.maxCostPerGB, 0.8);
    });

});
