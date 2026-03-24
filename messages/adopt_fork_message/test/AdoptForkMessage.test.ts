import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AdoptForkMessage } from '../AdoptForkMessage';

describe('Messages: AdoptForkMessage', () => {

    it('Initializes with direct options properties correctly', () => {
        const msg = new AdoptForkMessage({
            forkId: 'fork-1',
            finalTipHash: 'hash-abc'
        });

        assert.strictEqual(msg.forkId, 'fork-1');
        assert.strictEqual(msg.finalTipHash, 'hash-abc');
    });

    it('Initializes via nested payload properties seamlessly', () => {
        const msg = new AdoptForkMessage({
            body: {
                forkId: 'fork-2',
                finalTipHash: 'hash-def'
            }
        });

        assert.strictEqual(msg.forkId, 'fork-2');
        assert.strictEqual(msg.finalTipHash, 'hash-def');
    });

    it('Updates attributes accurately leveraging class dynamic setters', () => {
        const msg = new AdoptForkMessage();
        msg.forkId = 'fork-3';
        msg.finalTipHash = 'hash-ghi';
        
        assert.strictEqual(msg.forkId, 'fork-3');
        assert.strictEqual(msg.body.forkId, 'fork-3');
        assert.strictEqual(msg.finalTipHash, 'hash-ghi');
        assert.strictEqual(msg.body.finalTipHash, 'hash-ghi');
    });

});
