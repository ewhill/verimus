import * as crypto from 'crypto';
import assert from 'node:assert';
import { describe, it, before, after } from 'node:test';

import { ethers } from 'ethers';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { BLOCK_TYPES } from '../../constants';
import { hydrateBlockBigInts } from '../../crypto_utils/EIP712Types';
import { createSignedMockBlock } from '../../test/utils/EIP712Mock';
import Ledger from '../Ledger';


describe('Backend: Ledger Integrity and Tamper Evidence', () => {
    let ledger: Ledger;
    let mongod: MongoMemoryServer;
    let testPort = 30009; // Use random port to prevent test collision in concurrent suites

    before(async () => {
        mongod = await MongoMemoryServer.create();
        const mongoUri = mongod.getUri();
        ledger = new Ledger(mongoUri);
        await ledger.init(testPort);
        await ledger.purgeChain();
    });

    after(async () => {
        if (ledger.collection) {
            await ledger.collection.drop();
        }
        if (ledger.peersCollection) {
            await ledger.peersCollection.drop();
        }
        if (ledger.client) {
            await ledger.client.close();
        }
        if (mongod) {
            await mongod.stop();
        }
    });

    it('Initializes with a Genesis Block', async () => {
        const latest = await ledger.getLatestBlock();
        assert.ok(latest, 'Genesis block should successfully exist');
        assert.strictEqual(latest.metadata.index, 1, 'Genesis block maps index 1');
        const fundingBlock = await ledger.getBlockByIndex(0);
        assert.strictEqual(latest.previousHash, fundingBlock?.hash, 'Genesis block computes previous hash definitionally');
    });

    it('Appends blocks with sequential index', async () => {
        const wallet = ethers.Wallet.createRandom();
        const dummyPayload = { encryptedPayloadBase64: 'abc', encryptedKeyBase64: 'xyz', encryptedIvBase64: '123' };
        
        // Ledger expects index 2 since Genesis is index 1
        const newBlock = await createSignedMockBlock(wallet, BLOCK_TYPES.STORAGE_CONTRACT, dummyPayload, 2);
        const previousBlock = await ledger.getLatestBlock();
        newBlock.previousHash = previousBlock.hash;
        
        // Ledger recalculates hashes implicitly when using its native appending sequence organically
        // Ledger recalculates hashes implicitly when using its native appending sequence organically
        const blockToHash = { ...newBlock };
        delete blockToHash.hash;
        newBlock.hash = crypto.createHash('sha256').update(JSON.stringify(blockToHash)).digest('hex');

        await ledger.addBlockToChain(newBlock);
        
        assert.strictEqual(newBlock.metadata.index, 2);
        assert.strictEqual(newBlock.signerAddress, wallet.address);

        const latest = await ledger.getLatestBlock();
        assert.strictEqual(latest.hash, newBlock.hash, 'Appended block must correctly correlate to head ledger pointers');
        assert.strictEqual(latest.metadata.index, 2);
    });

    it('Strictly processes VALIDATOR_REGISTRATION payload hydration matrices natively', async () => {
        const wallet = ethers.Wallet.createRandom();
        const validatorPayload = { validatorAddress: wallet.address, stakeAmount: 1000n, action: 'STAKE' };
        
        // Ledger expects index 3 since previous block was 2
        const prevBlock = await ledger.getLatestBlock();
        const newBlock = await createSignedMockBlock(wallet, BLOCK_TYPES.VALIDATOR_REGISTRATION, validatorPayload, prevBlock.metadata.index + 1);
        newBlock.previousHash = prevBlock.hash;
        
        const blockToHash = { ...newBlock };
        delete blockToHash.hash;
        newBlock.hash = crypto.createHash('sha256').update(JSON.stringify(blockToHash)).digest('hex');

        await ledger.addBlockToChain(newBlock);
        
        const latest = await ledger.getLatestBlock();
        hydrateBlockBigInts(latest);
        assert.strictEqual(latest.type, BLOCK_TYPES.VALIDATOR_REGISTRATION);
        assert.strictEqual(latest.payload.validatorAddress, wallet.address);
        assert.strictEqual(typeof latest.payload.stakeAmount, 'bigint');
        assert.strictEqual(latest.payload.stakeAmount, 1000n);
        assert.strictEqual(latest.payload.action, 'STAKE');
    });

    it('Validates cryptography of chain', async () => {
        const isValid = await ledger.isChainValid();
        assert.strictEqual(isValid, true, 'Cryptographic properties should confirm continuous validity internally');
    });

    it('Invalidates chain state on payload tampering', async () => {
        const latestBlock = await ledger.getLatestBlock();
        
        // Manually tamper the database sequence directly to simulate node tampering/attack vectors
        await ledger.collection!.updateOne({ "metadata.index": latestBlock.metadata.index }, { $set: { signerAddress: 'TAMPERED_KEY' }});

        const isStillValid = await ledger.isChainValid();
        assert.strictEqual(isStillValid, false, 'Chain state must definitively catch internal hash deviations via rigorous validations');
    });

    it('Preserves peers collection during ledger purge', async () => {
        // Mock a peer locally inside the database tracking
        await ledger.peersCollection!.insertOne({
            operatorAddress: 'HONEST_NODE',
            score: 100,
            strikeCount: 0,
            isBanned: false,
            lastOffense: null
        });

        // Trigger the destructive ledger purge 
        await ledger.purgeChain();

        const peer = await ledger.peersCollection!.findOne({ operatorAddress: 'HONEST_NODE' });
        assert.ok(peer, 'Peers collection data must absolutely survive ledger sequence wiping');
        assert.strictEqual(peer.score, 100, 'Peer score mappings inherently immutable across DB lifecycle operations');
    });
});
