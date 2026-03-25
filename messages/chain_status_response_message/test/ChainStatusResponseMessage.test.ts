import assert from 'node:assert';
import { describe, it } from 'node:test';

import { ChainStatusResponseMessage } from '../ChainStatusResponseMessage';

describe('Messages: ChainStatusResponseMessage', () => {

    it('Initializes with direct options properties correctly', () => {
        const msg = new ChainStatusResponseMessage({ latestIndex: 100, latestHash: 'hash-xyz' });
        assert.strictEqual(msg.latestIndex, 100);
        assert.strictEqual(msg.latestHash, 'hash-xyz');
    });

    it('Initializes via nested payload properties', () => {
        const msg = new ChainStatusResponseMessage({ body: { latestIndex: 200, latestHash: 'hash-lmn' } });
        assert.strictEqual(msg.latestIndex, 200);
        assert.strictEqual(msg.latestHash, 'hash-lmn');
    });

    it('Updates attributes leveraging class dynamic setters', () => {
        const msg = new ChainStatusResponseMessage();
        msg.latestIndex = 300;
        msg.latestHash = 'hash-opq';
        assert.strictEqual(msg.latestIndex, 300);
        assert.strictEqual(msg.latestHash, 'hash-opq');
        assert.strictEqual(msg.body.latestIndex, 300);
        assert.strictEqual(msg.body.latestHash, 'hash-opq');
    });

});
