import { describe, it } from 'node:test';
import assert from 'node:assert';
import { StorageRequestMessage } from '../StorageRequestMessage';

describe('Messages: StorageRequestMessage Definitions', () => {

    it('Initializes with direct options properties correctly', () => {
        const msg = new StorageRequestMessage({
            storageRequestId: 'req-123',
            fileSizeBytes: 1024,
            chunkSizeBytes: 64,
            requiredNodes: 3,
            maxCostPerGB: 0.05,
            senderId: 'PUBKEY'
        });

        assert.strictEqual(msg.storageRequestId, 'req-123');
        assert.strictEqual(msg.fileSizeBytes, 1024);
        assert.strictEqual(msg.chunkSizeBytes, 64);
        assert.strictEqual(msg.requiredNodes, 3);
        assert.strictEqual(msg.maxCostPerGB, 0.05);
        assert.strictEqual(msg.senderId, 'PUBKEY');
    });

    it('Initializes via nested payload properties seamlessly', () => {
        const msg = new StorageRequestMessage({
            body: {
                storageRequestId: 'req-ABC',
                fileSizeBytes: 2048,
                chunkSizeBytes: 128,
                requiredNodes: 5,
                maxCostPerGB: 0.1,
                senderId: 'PUBKEY2'
            }
        });

        assert.strictEqual(msg.storageRequestId, 'req-ABC');
        assert.strictEqual(msg.fileSizeBytes, 2048);
        assert.strictEqual(msg.chunkSizeBytes, 128);
        assert.strictEqual(msg.requiredNodes, 5);
        assert.strictEqual(msg.maxCostPerGB, 0.1);
        assert.strictEqual(msg.senderId, 'PUBKEY2');
    });

    it('Mutates structured data payloads accurately supporting dynamic setters', () => {
        const msg = new StorageRequestMessage();
        msg.senderId = 'MOCK_KEY';
        msg.maxCostPerGB = 0.8;
        
        assert.strictEqual(msg.senderId, 'MOCK_KEY');
        assert.strictEqual(msg.maxCostPerGB, 0.8);
        assert.strictEqual(msg.body.maxCostPerGB, 0.8);
    });

});
