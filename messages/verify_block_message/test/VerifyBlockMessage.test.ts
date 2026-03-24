import { describe, it } from 'node:test';
import assert from 'node:assert';
import { VerifyBlockMessage } from '../VerifyBlockMessage';

describe('Messages: VerifyBlockMessage', () => {

    it('Initializes with direct options properties correctly', () => {
        const msg = new VerifyBlockMessage({ blockId: 'b-999', signature: 'SIG' });
        assert.strictEqual(msg.blockId, 'b-999');
        assert.strictEqual(msg.signature, 'SIG');
    });

    it('Initializes via nested payload properties seamlessly', () => {
        const msg = new VerifyBlockMessage({ body: { blockId: 'b-888', signature: 'SIG2' } });
        assert.strictEqual(msg.blockId, 'b-888');
        assert.strictEqual(msg.signature, 'SIG2');
    });

    it('Updates attributes accurately leveraging class dynamic setters', () => {
        const msg = new VerifyBlockMessage();
        msg.blockId = 'b-777';
        msg.signature = 'SIG3';
        assert.strictEqual(msg.blockId, 'b-777');
        assert.strictEqual(msg.body.blockId, 'b-777');
        assert.strictEqual(msg.signature, 'SIG3');
        assert.strictEqual(msg.body.signature, 'SIG3');
    });

});
