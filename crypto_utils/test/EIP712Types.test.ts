import assert from 'node:assert';
import test from 'node:test';

import { ethers } from 'ethers';

import { BLOCK_TYPES } from '../../constants';
import { Block, CheckpointStatePayload } from '../../types';
import { hydrateBlockBigInts } from '../EIP712Types';
import { EIP712_DOMAIN, EIP712_SCHEMAS } from '../EIP712Types';

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

test('EIP712Types: signTypedData accepts M1 properties (expirationBlockHeight, allocatedRestToll)', async () => {
    const wallet = ethers.Wallet.createRandom();
    const payload = {
        encryptedPayloadBase64: 'enc',
        encryptedKeyBase64: 'enc',
        encryptedIvBase64: 'enc',
        encryptedAuthTagBase64: 'enc',
        allocatedRestToll: 1000n,
        expirationBlockHeight: 300n,
        allocatedEgressEscrow: 50n,
        remainingEgressEscrow: 20n,
        marketId: 'market1',
        activeHosts: ['host1'],
        erasureParams: { n: 3n, k: 2n, originalSize: 1024n },
        fragmentMap: [],
        merkleRoots: [],
        ownerAddress: wallet.address,
        ownerSignature: 'sig',
        brokerFeePercentage: 1n
    };

    const blockType = EIP712_SCHEMAS[BLOCK_TYPES.STORAGE_CONTRACT];
    const typesToSign = { ...blockType };
    delete typesToSign['Block'];

    const signature = await wallet.signTypedData(
        EIP712_DOMAIN,
        typesToSign,
        payload
    );

    assert.ok(signature.startsWith('0x'), 'Signature successfully generated over schema validating BigInt execution without domain discrepancies');
});
