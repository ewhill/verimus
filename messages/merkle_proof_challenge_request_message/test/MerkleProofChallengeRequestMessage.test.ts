import assert from 'node:assert';
import { describe, it } from 'node:test';

import { MerkleProofChallengeRequestMessage } from '../MerkleProofChallengeRequestMessage';

describe('Messages: MerkleProofChallengeRequestMessage Definitions', () => {

    it('Initializes with direct options properties correctly', () => {
        const msg = new MerkleProofChallengeRequestMessage({
            contractId: 'contract123',
            auditorPublicKey: 'pk456',
            chunkIndex: 50
        });

        assert.strictEqual(msg.contractId, 'contract123');
        assert.strictEqual(msg.auditorPublicKey, 'pk456');
        assert.strictEqual(msg.chunkIndex, 50);
    });

    it('Initializes via nested payload properties', () => {
        const msg = new MerkleProofChallengeRequestMessage({
            body: {
                contractId: 'contract789',
                auditorPublicKey: 'pk999',
                chunkIndex: 2
            }
        });

        assert.strictEqual(msg.contractId, 'contract789');
        assert.strictEqual(msg.auditorPublicKey, 'pk999');
        assert.strictEqual(msg.chunkIndex, 2);
    });

    it('Mutates structured data payloads supporting dynamic setters', () => {
        const msg = new MerkleProofChallengeRequestMessage();
        
        msg.contractId = 'dyn_contract';
        msg.auditorPublicKey = 'dyn_pk';
        msg.chunkIndex = 1200;

        assert.strictEqual(msg.contractId, 'dyn_contract');
        assert.strictEqual(msg.auditorPublicKey, 'dyn_pk');
        assert.strictEqual(msg.chunkIndex, 1200);
    });
});
