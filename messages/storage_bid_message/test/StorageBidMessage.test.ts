import { describe, it } from 'node:test';
import assert from 'node:assert';
import { StorageBidMessage } from '../StorageBidMessage';

describe('Messages: StorageBidMessage Integrity Limits', () => {

    it('Translates host metrics and pricing vectors upon instantiation', () => {
        const msg = new StorageBidMessage({
            storageRequestId: 'req-456',
            storageHostId: 'HOST_PUBKEY',
            proposedCostPerGB: 0.02,
            guaranteedUptimeMs: 86400000
        });

        assert.strictEqual(msg.storageRequestId, 'req-456');
        assert.strictEqual(msg.storageHostId, 'HOST_PUBKEY');
        assert.strictEqual(msg.proposedCostPerGB, 0.02);
        assert.strictEqual(msg.guaranteedUptimeMs, 86400000);
    });

    it('Recovers properties spanning nested payload arrays accurately', () => {
        const msg = new StorageBidMessage({
            body: {
                storageRequestId: 'req-999',
                storageHostId: 'NODE_X',
                proposedCostPerGB: 0.001,
                guaranteedUptimeMs: 3600000
            }
        });

        assert.strictEqual(msg.storageRequestId, 'req-999');
        assert.strictEqual(msg.storageHostId, 'NODE_X');
        assert.strictEqual(msg.proposedCostPerGB, 0.001);
        assert.strictEqual(msg.guaranteedUptimeMs, 3600000);
    });

    it('Updates core payload attributes through class setter boundaries', () => {
        const msg = new StorageBidMessage();
        msg.proposedCostPerGB = 0.5;
        msg.storageHostId = 'PROXY_1';
        
        assert.strictEqual(msg.proposedCostPerGB, 0.5);
        assert.strictEqual(msg.body.proposedCostPerGB, 0.5);
        assert.strictEqual(msg.storageHostId, 'PROXY_1');
    });

});
