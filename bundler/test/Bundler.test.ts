import assert from 'node:assert';
import { describe, it } from 'node:test';

import Bundler from '../../bundler/Bundler';

describe('Bundler: Erasure Coding Geometry Metrics', () => {

    it('Splits a buffer array matching linear K/N matrix bounds', async () => {
        const payloadStr = 'Decentralized erasure coding distributing geometric shards scaling matrix topologies spanning arbitrary architectures!'.repeat(5); // Repeated sufficiently to ensure shard division pads zeroes
        const payloadBuf = Buffer.from(payloadStr, 'utf8');

        // Target: N=5 total shards, K=3 required shards to decrypt
        const N = 5;
        const K = 3;

        const shards = await Bundler.encodeErasureShards(payloadBuf, K, N);
        assert.strictEqual(shards.length, 5, 'Matrix successfully branched generating exactly arrays of N shards.');

        // Reconstruct matching 100% fragments present locally
        const reconstructedFull = await Bundler.reconstructErasureShards(shards, K, N, payloadBuf.length);
        assert.strictEqual(reconstructedFull.toString('utf8'), payloadStr, 'Original payload restored mapping 100% shards.');

        // Missing 2 shards (still >= K shards remaining)
        const corruptedShards = [shards[0], null, shards[2], null, shards[4]];
        const reconstructedPartial = await Bundler.reconstructErasureShards(corruptedShards, K, N, payloadBuf.length);
        assert.strictEqual(reconstructedPartial.toString('utf8'), payloadStr, 'Linear recovery algorithm bridged physical bounds mathematically mirroring exact original array states.');
    });

    it('Throws errors if available data limits drop beneath minimum threshold', async () => {
        const payloadBuf = Buffer.from('Strict boundary checks asserting cryptographic failure correctly.', 'utf8');
        const N = 4;
        const K = 3;

        const shards = await Bundler.encodeErasureShards(payloadBuf, K, N);
        
        // Corrupt eliminating 2 fragments where P=1 parity limits drop mapping constraints
        const brokenShards = [shards[0], null, null, shards[3]];
        
        try {
            await Bundler.reconstructErasureShards(brokenShards, K, N, payloadBuf.length);
            assert.fail('Should evaluate failure throwing bounds');
        } catch (e: any) {
            assert.ok(e.message.includes('code: 10'), 'Erasure boundaries successfully failed resolving limits.');
        }
    });
});
