import { describe, it } from 'node:test';
import assert from 'node:assert';
import Bundler from '../../bundler/Bundler';

describe('Bundler: Erasure Coding Geometry Metrics', () => {

    it('Splits a buffer array cleanly matching linear K/N matrix bounds natively', async () => {
        const payloadStr = 'Decentralized erasure coding natively distributing physical geometric shards cleanly scaling matrix topologies robustly spanning arbitrary architectures!'.repeat(5); // Repeated sufficiently to ensure shard division pads zeroes
        const payloadBuf = Buffer.from(payloadStr, 'utf8');

        // Target: N=5 total shards, K=3 required shards to decrypt
        const N = 5;
        const K = 3;

        const shards = await Bundler.encodeErasureShards(payloadBuf, K, N);
        assert.strictEqual(shards.length, 5, 'Matrix successfully branched generating explicitly exactly arrays of N shards natively.');

        // Reconstruct actively matching 100% fragments present locally natively
        const reconstructedFull = await Bundler.reconstructErasureShards(shards, K, N, payloadBuf.length);
        assert.strictEqual(reconstructedFull.toString('utf8'), payloadStr, 'Original payload restored mapping 100% shards flawlessly!');

        // Missing 2 shards dynamically (still >= K shards remaining physically)
        const corruptedShards = [shards[0], null, shards[2], null, shards[4]];
        const reconstructedPartial = await Bundler.reconstructErasureShards(corruptedShards, K, N, payloadBuf.length);
        assert.strictEqual(reconstructedPartial.toString('utf8'), payloadStr, 'Linear recovery algorithm bridged physical bounds mathematically mirroring exact original array states flawlessly natively!');
    });

    it('Throws errors mapping strict constraints dynamically if available data limits drop beneath minimum threshold natively', async () => {
        const payloadBuf = Buffer.from('Strict boundary checks asserting cryptographic failure correctly natively.', 'utf8');
        const N = 4;
        const K = 3;

        const shards = await Bundler.encodeErasureShards(payloadBuf, K, N);
        
        // Corrupt strictly eliminating 2 fragments structurally where P=1 parity limits drop mapping constraints natively
        const brokenShards = [shards[0], null, null, shards[3]];
        
        try {
            await Bundler.reconstructErasureShards(brokenShards, K, N, payloadBuf.length);
            assert.fail('Should evaluate failure dynamically throwing bounds accurately');
        } catch (e: any) {
            assert.ok(e.message.includes('code: 10'), 'Erasure boundaries successfully failed resolving limits proactively cleanly!');
        }
    });
});
