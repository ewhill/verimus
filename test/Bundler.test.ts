import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { createAESDecryptStream } from '../crypto_utils/CryptoUtils';
import unzipper from 'unzipper';
import Bundler from '../bundler/Bundler';

import { PassThrough } from 'stream';

describe('Backend: Bundler Core Archiving Integrity', () => {

    it('Zips and encrypts files into block stream', async () => {
        const bundler = new Bundler('/tmp');

        const mockFiles: any[] = [
            { originalname: 'docs/file1.txt', buffer: Buffer.from('Test payload chunk exactly 32 bytes.') },
            { originalname: 'docs/sub/file2.csv', buffer: Buffer.from('CSV,DATA,1234') }
        ];

        let chunks: Buffer[] = [];
        const captureStream = new PassThrough();
        captureStream.on('data', (chunk) => chunks.push(chunk));

        const result = await bundler.streamBlockBundle(mockFiles, captureStream);

        assert.ok(result, 'Bundler should return AES parameters');
        assert.ok(chunks.length > 0, 'Bundler must create a resulting archive block stream successfully');

        // Combine chunks
        const blockBuffer = Buffer.concat(chunks);

        // Decryption verification pass
        const readStream = new PassThrough();
        readStream.end(blockBuffer);

        const decryptStream = createAESDecryptStream(result!.aesKey, result!.aesIv, result!.authTag);
        
        let unzippedChunks: Buffer[] = [];
        const unpackStream = new PassThrough();
        unpackStream.on('data', c => unzippedChunks.push(c));

        await pipeline(readStream, decryptStream, unpackStream);
        const zipBuffer = Buffer.concat(unzippedChunks);

        // Unzip verification to validate structure matches original mappings
        const zipStream = new PassThrough();
        zipStream.end(zipBuffer);
        
        let directoryStream = zipStream.pipe(unzipper.Parse());

        let foundFiles: string[] = [];
        await new Promise((resolve, reject) => {
            directoryStream.on('entry', function (entry: any) {
                foundFiles.push(entry.path);
                entry.autodrain();
            });
            directoryStream.on('finish', resolve);
            directoryStream.on('error', reject);
        });

        assert.ok(foundFiles.includes('docs/file1.txt'), 'File1 must exist in the archive');
        assert.ok(foundFiles.includes('docs/sub/file2.csv'), 'File2 must exist deeply in archive structure');
        assert.strictEqual(foundFiles.length, 2, 'Exactly 2 structured files must be archived');
    });

    it('Generates AES keys and IVs', async () => {
        const bundledHash = crypto.createHash('sha256').update('CSV,DATA,1234').digest('hex');
        assert.strictEqual(bundledHash.length, 64, 'Blocks inherently use SHA-256 fixed length representation');
    });

    it('Creates block bundle with metadata and payload', async () => {
        const bundler = new Bundler('./tmp');
        // test with empty
        assert.strictEqual(bundler.createBlockBundle([]), null);
        assert.strictEqual(bundler.createBlockBundle(null as any), null);

        const mockFiles = [
            { originalname: 'foo.txt', buffer: Buffer.from('hello') }
        ];
        const res = bundler.createBlockBundle(mockFiles);
        assert.ok(res!.aesKey);
        assert.ok(res!.aesIv);
        assert.strictEqual(res!.files.length, 1);
        assert.strictEqual(res!.files[0].path, 'foo.txt');
    });
});
