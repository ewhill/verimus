import assert from 'node:assert';
import test from 'node:test';

import { BLOCK_TYPES } from '../../constants';
import { hydrateBlockBigInts } from '../EIP712Types';
import { Block, CheckpointStatePayload } from '../../types';

test('EIP712Types: hydrateBlockBigInts Enforces Strict Deserialization Boundaries', async (t) => {
    await t.test('Throws explicit Invalid Payload exception if native maximum safe JS number float bounds breached', () => {
        // Construct a synthetically decoded JSON payload bypassing string boundaries with raw JS floats natively via number casting mechanically
        const mockBlock = {
            type: BLOCK_TYPES.CHECKPOINT,
            payload: {
                epochIndex: 9007199254740995 // Raw JS number!
            } as any
        } as Block;

        assert.throws(() => {
            hydrateBlockBigInts(mockBlock);
        }, /Invalid Payload/, 'Should throw strict bounds error rejecting numerical truncation explicitly!');
    });

    await t.test('Successfully casts strictly mapped string variables cleanly back natively to BigInt struct elements precisely without truncation limits', () => {
        // Safe cleanly quoted string mimicking network edge HTTP exact bounds mapping without JSON.parse float interception natively exactly 
        const safeBlock = {
            type: BLOCK_TYPES.CHECKPOINT,
            payload: {
                epochIndex: '9007199254740995' // Explicit stringified JSON body transmission 
            } as any
        } as Block;

        hydrateBlockBigInts(safeBlock);
        
        const payload = safeBlock.payload as CheckpointStatePayload;
        assert.strictEqual(typeof payload.epochIndex, 'bigint');
        assert.strictEqual(payload.epochIndex.toString(), '9007199254740995'); // Proving exactly ZERO numeric float mutation! 
    });
});
