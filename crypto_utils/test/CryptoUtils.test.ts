import assert from 'node:assert';
import { describe, it } from 'node:test';
import { Transform } from 'stream';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

import { 
    createAESStream, 
    createAESDecryptStream,
    generateRSAKeyPair,
    encryptPrivatePayload,
    decryptPrivatePayload,
    buildMerkleTree,
    getMerkleProof,
    verifyMerkleProof
} from '../CryptoUtils';

describe('Backend: Crypto Utils Unit Tests', () => {

    it('Encrypts and decrypts streaming data via AES', async () => {
        const testData = "This is highly confidential Verimus internal block data that requires rigorous encryption!";
        
        // Mock Readable
        const sourceStream = new Transform({
            transform(chunk, _unusedEncoding, callback) {
                callback(null, chunk);
            }
        });
        
        const { cipherStream, key, iv, getAuthTag } = createAESStream();
        let encryptedChunks: Buffer[] = [];
        const captureEncrypted = new Transform({
            transform(chunk, _unusedEncoding, callback) {
                encryptedChunks.push(chunk);
                callback(null, chunk);
            }
        });

        // Run AES pipeline async
        sourceStream.write(testData);
        sourceStream.end();

        await pipeline(
            sourceStream,
            cipherStream,
            captureEncrypted
        );

        const authTag = getAuthTag().toString('hex');
        const decryptStream = createAESDecryptStream(key, iv, authTag);
        
        let decryptedOutput = '';
        const outputStream = new Transform({
            transform(chunk, _unusedEncoding, callback) {
                decryptedOutput += chunk.toString('utf-8');
                callback(null, chunk);
            }
        });


        await pipeline(
            Readable.from(Buffer.concat(encryptedChunks)),
            decryptStream,
            outputStream
        );

        assert.strictEqual(decryptedOutput, testData, 'Decrypted output must match original stream data');
    });

    it('Generates RSA 2048-bit keypair Strings', async () => {
        const { publicKey, privateKey } = await generateRSAKeyPair();
        assert.ok(publicKey.includes('BEGIN PUBLIC KEY'), 'Must contain public PEM header');
        assert.ok(privateKey.includes('BEGIN PRIVATE KEY'), 'Must contain private PEM header');
    });

    it('Encrypts and decrypts payload metadata via RSA', async () => {
        const { publicKey, privateKey } = await generateRSAKeyPair();
        
        const privatePayload = {
            key: "test-aes-key-32-chars-long-------",
            iv: "test-aes-iv-16ch",
            physicalId: "chunk-100234",
            location: { type: 'local', storageDir: '/tmp' },
            files: [{ path: '/folder/seed.txt', contentHash: 'abcd1234abcd1234abcd1234' }]
        };

        const encrypted = encryptPrivatePayload(publicKey, privatePayload);

        assert.ok(encrypted.encryptedPayloadBase64, 'Encrypted bundle should generate a base64 payload body');
        assert.ok(encrypted.encryptedKeyBase64, 'AES envelope key should be asymmetrically encrypted');
        assert.ok(encrypted.encryptedIvBase64, 'AES envelope IV should be asymmetrically encrypted');

        const decrypted = decryptPrivatePayload(privateKey, encrypted);

        assert.strictEqual(decrypted.key, privatePayload.key, 'Decrypted payload KEY must match');
        assert.strictEqual(decrypted.iv, privatePayload.iv, 'Decrypted payload IV must match');
        assert.strictEqual(decrypted.physicalId, privatePayload.physicalId, 'Decrypted properties must match original payload structure');
    });

    it('Builds mathematical Merkle Trees generating sibling proofs targeting root boundaries', async () => {
        const leaves = [
            Buffer.from('chunk0'),
            Buffer.from('chunk1'),
            Buffer.from('chunk2'),
            Buffer.from('chunk3'),
            Buffer.from('chunk4') // Note: Odd number deliberately mapped
        ];

        const { tree, root } = buildMerkleTree(leaves);

        assert.ok(tree.length > 2, 'Tree must map multidimensional layers');
        assert.ok(root, 'Root hash cleanly materialized natively');

        // Target middle leaf chunk 2
        const proof = getMerkleProof(tree, 2);
        assert.ok(proof.length > 0, 'Proof mapping extracts boundaries successfully');

        const validProof = verifyMerkleProof(leaves[2], proof, root, 2);
        assert.strictEqual(validProof, true, 'Merkle sibling escalation strictly proven correctly');

        const invalidBuffer = verifyMerkleProof(Buffer.from('garbageData'), proof, root, 2);
        assert.strictEqual(invalidBuffer, false, 'Invalid data cleanly rejects during bounds validation');

        const driftProof = verifyMerkleProof(leaves[3], proof, root, 2);
        assert.strictEqual(driftProof, false, 'Invalid sibling path mappings naturally reject internally');
    });
});
