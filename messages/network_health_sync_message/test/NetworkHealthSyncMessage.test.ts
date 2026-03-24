import { describe, it } from 'node:test';
import assert from 'node:assert';
import { NetworkHealthSyncMessage } from '../NetworkHealthSyncMessage';
import { NodeRole } from '../../../types/NodeRole';

describe('Messages: NetworkHealthSyncMessage', () => {

    const payloads = [{ publicKey: 'PK1', score: 95, roles: [NodeRole.STORAGE] }];

    it('Initializes with direct options properties correctly', () => {
        const msg = new NetworkHealthSyncMessage({ score_payloads: payloads });
        assert.deepEqual(msg.score_payloads, payloads);
    });

    it('Initializes via nested payload properties seamlessly', () => {
        const msg = new NetworkHealthSyncMessage({ body: { score_payloads: payloads } });
        assert.deepEqual(msg.score_payloads, payloads);
    });

    it('Updates attributes accurately leveraging class dynamic setters', () => {
        const msg = new NetworkHealthSyncMessage();
        msg.score_payloads = payloads;
        assert.deepEqual(msg.score_payloads, payloads);
        assert.deepEqual(msg.body.score_payloads, payloads);
    });

    it('Returns empty array mapping if null naturally', () => {
        const msg = new NetworkHealthSyncMessage();
        assert.deepEqual(msg.score_payloads, []);
    });

});
