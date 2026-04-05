import assert from 'node:assert';
import { describe, it } from 'node:test';

import { NodeRole } from '../../../types/NodeRole';
import { NetworkHealthSyncMessage } from '../NetworkHealthSyncMessage';

describe('Messages: NetworkHealthSyncMessage', () => {

    const payloads = [{ operatorAddress: 'PK1', score: 95, roles: [NodeRole.STORAGE] }];

    it('Initializes with direct options properties correctly', () => {
        const msg = new NetworkHealthSyncMessage({ score_payloads: payloads });
        assert.deepEqual(msg.score_payloads, payloads);
    });

    it('Initializes via nested payload properties', () => {
        const msg = new NetworkHealthSyncMessage({ body: { score_payloads: payloads } });
        assert.deepEqual(msg.score_payloads, payloads);
    });

    it('Updates attributes leveraging class dynamic setters', () => {
        const msg = new NetworkHealthSyncMessage();
        msg.score_payloads = payloads;
        assert.deepEqual(msg.score_payloads, payloads);
        assert.deepEqual(msg.body.score_payloads, payloads);
    });

    it('Returns empty array if null', () => {
        const msg = new NetworkHealthSyncMessage();
        assert.deepEqual(msg.score_payloads, []);
    });

});
