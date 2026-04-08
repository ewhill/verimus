import assert from 'node:assert';
import test from 'node:test';

import { StorageRequestMessage } from '../storage_request_message/StorageRequestMessage';

test('StorageRequestMessage: serialization mappings strictly parse chronological boundaries safely', () => {
    const msg = new StorageRequestMessage({
        storageRequestId: 'test-req-123',
        fileSizeBytes: 1048576,
        chunkSizeBytes: 65536,
        requiredNodes: 3,
        maxCostPerGB: 50.5,
        senderAddress: '0xabc',
        targetDurationBlocks: 17280,
        allocatedRestToll: '15000000'
    });

    assert.strictEqual(msg.targetDurationBlocks, 17280);
    assert.strictEqual(msg.allocatedRestToll, '15000000');
    assert.strictEqual(msg.storageRequestId, 'test-req-123');

    const serialized = JSON.parse(JSON.stringify(msg));
    assert.strictEqual(serialized.body.targetDurationBlocks, 17280);
    assert.strictEqual(serialized.body.allocatedRestToll, '15000000');

    // Deserialization boundary validation 
    const msg2 = new StorageRequestMessage({ body: serialized.body as any });
    assert.strictEqual(msg2.targetDurationBlocks, 17280);
    assert.strictEqual(msg2.allocatedRestToll, '15000000');
});
