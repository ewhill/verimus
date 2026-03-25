export { };
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { hashData, encryptAES, createAESStream } = require('../crypto_utils/CryptoUtils');

class Bundler {
    dataDir: string;

    constructor(dataDir: string) {
        this.dataDir = dataDir;
    }

    /**
     * Translates a linear payload buffer into an Erasure Coding N/K matrix seamlessly natively.
     */
    static async encodeErasureShards(buffer: Buffer, K: number, N: number): Promise<Buffer[]> {
        const { ReedSolomonErasure } = require('@subspace/reed-solomon-erasure.wasm');
        const wasmPath = require.resolve('@subspace/reed-solomon-erasure.wasm/dist/reed_solomon_erasure_bg.wasm');
        const rs = ReedSolomonErasure.fromBytes(require('fs').readFileSync(wasmPath));

        const P = N - K;
        if (P < 0) throw new Error("Parity shards cannot be negative natively mapping.");

        // Pad buffer so it divides evenly by K
        const shardSize = Math.ceil(buffer.length / K);
        const paddedLength = shardSize * K;

        const shardsBuf = Buffer.alloc(shardSize * N);
        buffer.copy(shardsBuf, 0); 

        // Pad the remainder of the K data shards with zeroes if needed
        if (buffer.length < paddedLength) {
            shardsBuf.fill(0, buffer.length, paddedLength);
        }

        const uint8Shards = new Uint8Array(shardsBuf.buffer, shardsBuf.byteOffset, shardsBuf.byteLength);
        const result = rs.encode(uint8Shards, K, P);
        if (result !== ReedSolomonErasure.RESULT_OK) {
            throw new Error(`Erasure encoding failed mapping bounds with code: ${result}`);
        }

        const outputShards: Buffer[] = [];
        for (let i = 0; i < N; i++) {
            outputShards.push(Buffer.from(uint8Shards.buffer, uint8Shards.byteOffset + i * shardSize, shardSize));
        }
        return outputShards;
    }

    /**
     * Reconstructs an original buffer given an array of physical fragments cleanly recursively natively.
     */
    static async reconstructErasureShards(shards: (Buffer | null)[], K: number, N: number, originalLength: number): Promise<Buffer> {
        if (shards.length !== N) throw new Error("Shards array physically strictly must match N bounds!");

        const { ReedSolomonErasure } = require('@subspace/reed-solomon-erasure.wasm');
        const wasmPath = require.resolve('@subspace/reed-solomon-erasure.wasm/dist/reed_solomon_erasure_bg.wasm');
        const rs = ReedSolomonErasure.fromBytes(require('fs').readFileSync(wasmPath));

        const P = N - K;
        
        let shardSize = 0;
        for (const s of shards) {
             if (s) { shardSize = s.length; break; }
        }
        if (shardSize === 0) throw new Error("No physical shard fragments available matching reconstruction recursively.");

        const shardsAvailable = shards.map(s => s !== null);
        const shardsBuf = Buffer.alloc(shardSize * N);

        for (let i = 0; i < N; i++) {
            if (shards[i]) {
                shards[i]!.copy(shardsBuf, i * shardSize);
            }
        }

        const uint8Shards = new Uint8Array(shardsBuf.buffer, shardsBuf.byteOffset, shardsBuf.byteLength);

        const result = rs.reconstruct(uint8Shards, K, P, shardsAvailable);
        if (result !== ReedSolomonErasure.RESULT_OK) {
            throw new Error(`Erasure reconstruction failed structurally with code: ${result}`);
        }

        const reconstructedData = Buffer.from(uint8Shards.buffer, uint8Shards.byteOffset, K * shardSize);
        return reconstructedData.subarray(0, originalLength); 
    }

    /**
     * Takes an array of uploaded files and bundles them into a block.
     */
    createBlockBundle(uploadedFiles: { originalname: string; buffer: Buffer }[]) {
        if (!uploadedFiles || uploadedFiles.length === 0) return null;

        const files: { path: string; contentHash: string; }[] = [];
        for (const file of uploadedFiles) {
            // file object from multer contains { originalname, buffer }
            files.push({
                path: file.originalname,
                contentHash: hashData(file.buffer),
            });
        }

        // Encrypt each of the plurality of data files in the block
        const blockString = JSON.stringify(files);
        const { encryptedData, key, iv } = encryptAES(Buffer.from(blockString, 'utf8'));

        return {
            blockData: encryptedData,
            aesKey: key,
            aesIv: iv,
            files,
        };
    }

    /**
     * Zips, encrypts, and streams uploaded files into outputStream.
     */
    streamBlockBundle(uploadedFiles: Express.Multer.File[], outputStream: NodeJS.WritableStream, sourcePaths: string[] = []) {
        return new Promise<{ aesKey: string, aesIv: string, authTag: string, files: { path: string; contentHash: string; }[] } | null>(async (resolve, reject) => {
            if (!uploadedFiles || uploadedFiles.length === 0) return resolve(null);

            const files: { path: string; contentHash: string; }[] = [];

            const archive = archiver('zip', {
                zlib: { level: 9 }
            });

            const { cipherStream, key, iv, getAuthTag } = createAESStream();

            outputStream.on('close', () => {
                resolve({
                    aesKey: key,
                    aesIv: iv,
                    authTag: getAuthTag().toString('hex'),
                    files: files
                });
            });

            outputStream.on('error', reject);
            archive.on('error', reject);
            cipherStream.on('error', reject);

            archive.pipe(cipherStream).pipe(outputStream);

            for (let i = 0; i < uploadedFiles.length; i++) {
                const file = uploadedFiles[i];
                const filePath = sourcePaths[i] || file.originalname;
                let contentHash = "";
                
                if (file.path) {
                    contentHash = await new Promise<string>((res, rej) => {
                        const hash = require('crypto').createHash('sha256');
                        const st = require('fs').createReadStream(file.path);
                        st.on('data', (d: any) => hash.update(d));
                        st.on('end', () => res(hash.digest('hex')));
                        st.on('error', rej);
                    });
                    files.push({ path: filePath, contentHash });
                    archive.append(require('fs').createReadStream(file.path), { name: filePath });
                } else if (file.buffer) {
                    contentHash = hashData(file.buffer);
                    files.push({ path: filePath, contentHash });
                    archive.append(file.buffer, { name: filePath });
                }
            }

            archive.finalize();
        });
    }
}

export default Bundler;
