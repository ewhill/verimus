import assert from 'node:assert';
import { describe, it } from 'node:test';

import { MerkleProofChallengeResponseMessage } from '../MerkleProofChallengeResponseMessage';

describe('Messages: MerkleProofChallengeResponseMessage Definitions', () => {

    it('Initializes with direct options properties correctly', () => {
        const msg = new MerkleProofChallengeResponseMessage({
            contractId: 'contract123',
            chunkDataBase64: 'ZGF0YTEyMw==',
            merkleSiblings: ['sib1', 'sib2'],
            computedRootMatch: true
        });

        assert.strictEqual(msg.contractId, 'contract123');
        assert.strictEqual(msg.chunkDataBase64, 'ZGF0YTEyMw==');
        assert.deepStrictEqual(msg.merkleSiblings, ['sib1', 'sib2']);
        assert.strictEqual(msg.computedRootMatch, true);
    });

    it('Initializes via nested payload properties', () => {
        const msg = new MerkleProofChallengeResponseMessage({
            body: {
                contractId: 'contract456',
                chunkDataBase64: 'fakedData',
                merkleSiblings: ['sib3'],
                computedRootMatch: false
            }
        });

        assert.strictEqual(msg.contractId, 'contract456');
        assert.strictEqual(msg.chunkDataBase64, 'fakedData');
        assert.deepStrictEqual(msg.merkleSiblings, ['sib3']);
        assert.strictEqual(msg.computedRootMatch, false);
    });

    it('Mutates structured data payloads supporting dynamic setters', () => {
        const msg = new MerkleProofChallengeResponseMessage();
        
        msg.contractId = 'dyn_contract';
        msg.chunkDataBase64 = 'dyn_data';
        msg.merkleSiblings = ['dyn1', 'dyn2'];
        msg.computedRootMatch = true;

        assert.strictEqual(msg.contractId, 'dyn_contract');
        assert.strictEqual(msg.chunkDataBase64, 'dyn_data');
        assert.deepStrictEqual(msg.merkleSiblings, ['dyn1', 'dyn2']);
        assert.strictEqual(msg.computedRootMatch, true);
    });
});
