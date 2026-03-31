import assert from 'node:assert';
import { describe, it, before, after } from 'node:test';

import { MongoMemoryServer } from 'mongodb-memory-server';

import proxyCrypto = require('../../crypto_utils/CryptoUtils');
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
        const { publicKey, privateKey } = proxyCrypto.generateRSAKeyPair();
        const dummyPayload = { encryptedPayloadBase64: 'abc', encryptedKeyBase64: 'xyz', encryptedIvBase64: '123' };
        const sig = proxyCrypto.signData(JSON.stringify(dummyPayload), privateKey) as string;
        const newBlock = await ledger.addBlock(publicKey, dummyPayload, sig);
        assert.strictEqual(newBlock.metadata.index, 2);
        assert.strictEqual(newBlock.publicKey, publicKey);

        const latest = await ledger.getLatestBlock();
        assert.strictEqual(latest.hash, newBlock.hash, 'Appended block must correctly correlate to head ledger pointers');
        assert.strictEqual(latest.metadata.index, 2);
    });

    it('Validates cryptography of chain', async () => {
        const isValid = await ledger.isChainValid();
        assert.strictEqual(isValid, true, 'Cryptographic properties should confirm continuous validity internally');
    });

    it('Invalidates chain state on payload tampering', async () => {
        const latestBlock = await ledger.getLatestBlock();
        
        // Manually tamper the database sequence directly to simulate node tampering/attack vectors
        await ledger.collection!.updateOne({ "metadata.index": latestBlock.metadata.index }, { $set: { publicKey: 'TAMPERED_KEY' }});

        const isStillValid = await ledger.isChainValid();
        assert.strictEqual(isStillValid, false, 'Chain state must definitively catch internal hash deviations via rigorous validations');
    });

    it('Preserves peers collection during ledger purge', async () => {
        // Mock a peer locally inside the database tracking
        await ledger.peersCollection!.insertOne({
            publicKey: 'HONEST_NODE',
            score: 100,
            strikeCount: 0,
            isBanned: false,
            lastOffense: null
        });

        // Trigger the destructive ledger purge 
        await ledger.purgeChain();

        const peer = await ledger.peersCollection!.findOne({ publicKey: 'HONEST_NODE' });
        assert.ok(peer, 'Peers collection data must absolutely survive ledger sequence wiping');
        assert.strictEqual(peer.score, 100, 'Peer score mappings inherently immutable across DB lifecycle operations');
    });
});
