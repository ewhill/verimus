import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ProposeForkMessage } from '../ProposeForkMessage';

describe('Messages: ProposeForkMessage', () => {

    it('Initializes with direct options properties correctly', () => {
        const msg = new ProposeForkMessage({ forkId: 'fork-A', blockIds: ['b1', 'b2'] });
        assert.strictEqual(msg.forkId, 'fork-A');
        assert.deepEqual(msg.blockIds, ['b1', 'b2']);
    });

    it('Initializes via nested payload properties seamlessly', () => {
        const msg = new ProposeForkMessage({ body: { forkId: 'fork-B', blockIds: ['b3'] } });
        assert.strictEqual(msg.forkId, 'fork-B');
        assert.deepEqual(msg.blockIds, ['b3']);
    });

    it('Updates attributes accurately leveraging class dynamic setters', () => {
        const msg = new ProposeForkMessage();
        msg.forkId = 'fork-C';
        msg.blockIds = ['b4'];
        assert.strictEqual(msg.forkId, 'fork-C');
        assert.strictEqual(msg.body.forkId, 'fork-C');
        assert.deepEqual(msg.blockIds, ['b4']);
        assert.deepEqual(msg.body.blockIds, ['b4']);
    });

});
