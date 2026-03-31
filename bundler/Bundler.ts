import * as crypto from 'crypto';
import * as fs from 'fs';

import { ReedSolomonErasure } from '@subspace/reed-solomon-erasure.wasm';
import archiver from 'archiver';

import { hashData, encryptAES, createAESStream, buildMerkleTree } from '../crypto_utils/CryptoUtils';

class Bundler {
    dataDir: string;

    constructor(dataDir: string) {
        this.dataDir = dataDir;
    }

    /**
     * Translates a linear payload buffer into an Erasure Coding N/K matrix.
     */
    static async encodeErasureShards(buffer: Buffer, K: number, N: number): Promise<Buffer[]> {
        const wasmPath = require.resolve('@subspace/reed-solomon-erasure.wasm/dist/reed_solomon_erasure_bg.wasm');
        const rs = ReedSolomonErasure.fromBytes(fs.readFileSync(wasmPath));

        const P = N - K;
        if (P < 0) throw new Error("Parity shards cannot be negative.");

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
        
        if (P > 0) {
            const result = rs.encode(uint8Shards, K, P);
            if (result !== ReedSolomonErasure.RESULT_OK) {
                throw new Error(`Erasure encoding failed with code: ${result}`);
            }
        }

        const outputShards: Buffer[] = [];
        for (let i = 0; i < N; i++) {
            outputShards.push(Buffer.from(uint8Shards.buffer, uint8Shards.byteOffset + i * shardSize, shardSize));
        }
        return outputShards;
    }

    /**
     * Reconstructs an original buffer given an array of fragments.
     */
    static async reconstructErasureShards(shards: (Buffer | null)[], K: number, N: number, originalLength: number): Promise<Buffer> {
        if (shards.length !== N) throw new Error("Shards array must match N bounds!");

        const wasmPath = require.resolve('@subspace/reed-solomon-erasure.wasm/dist/reed_solomon_erasure_bg.wasm');
        const rs = ReedSolomonErasure.fromBytes(fs.readFileSync(wasmPath));

        const P = N - K;
        
        let shardSize = 0;
        for (const s of shards) {
             if (s) { shardSize = s.length; break; }
        }
        if (shardSize === 0) throw new Error("No shard fragments available for reconstruction.");

        const shardsAvailable = shards.map(s => s !== null);
        const shardsBuf = Buffer.alloc(shardSize * N);

        for (let i = 0; i < N; i++) {
            if (shards[i]) {
                shards[i]!.copy(shardsBuf, i * shardSize);
            }
        }

        const uint8Shards = new Uint8Array(shardsBuf.buffer, shardsBuf.byteOffset, shardsBuf.byteLength);

        if (P > 0) {
            const result = rs.reconstruct(uint8Shards, K, P, shardsAvailable);
            if (result !== ReedSolomonErasure.RESULT_OK) {
                throw new Error(`Erasure reconstruction failed with code: ${result}`);
            }
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
                        const hash = crypto.createHash('sha256');
                        const st = fs.createReadStream(file.path);
                        st.on('data', (d: any) => hash.update(d));
                        st.on('end', () => res(hash.digest('hex')));
                        st.on('error', rej);
                    });
                    files.push({ path: filePath, contentHash });
                    archive.append(fs.createReadStream(file.path), { name: filePath });
                } else if (file.buffer) {
                    contentHash = hashData(file.buffer);
                    files.push({ path: filePath, contentHash });
                    archive.append(file.buffer, { name: filePath });
                }
            }

            archive.finalize();
        });
    }

    /**
     * Zips, encrypts, and buffers uploaded files, calculating Reed-Solomon Erasure subsets mathematically.
     */
    streamErasureBundle(uploadedFiles: Express.Multer.File[], K: number, N: number, sourcePaths: string[] = [], onProgress?: (status: string, message: string, bytes?: number) => void) {
        return new Promise<{ 
            aesKey: string, 
            aesIv: string, 
            authTag: string, 
            files: { path: string; contentHash: string; }[],
            shards: Buffer[],
            originalSize: number,
            merkleRoots: string[]
        } | null>(async (resolve, reject) => {
            if (!uploadedFiles || uploadedFiles.length === 0) return resolve(null);

            const files: { path: string; contentHash: string; }[] = [];
            const archive = archiver('zip', { zlib: { level: 9 } });
            const { cipherStream, key, iv, getAuthTag } = createAESStream();

            const chunks: Buffer[] = [];
            let processedBytes = 0;
            let lastAesEmitBytes = 0;
            cipherStream.on('data', (chunk) => {
                processedBytes += chunk.length;
                chunks.push(Buffer.from(chunk));
                if (onProgress && processedBytes - lastAesEmitBytes > 1024 * 512) { // Emit every 512KB restricting SSE flood
                    lastAesEmitBytes = processedBytes;
                    onProgress('AES_ENCRYPTION', `AES-256-GCM Encryption Trace [${processedBytes} Bytes Processed]`, processedBytes);
                }
            });
            
            cipherStream.on('end', async () => {
                if (onProgress && processedBytes > lastAesEmitBytes) {
                    onProgress('AES_ENCRYPTION', `AES-256-GCM Encryption Trace [${processedBytes} Bytes Processed]`, processedBytes);
                }
                const finalBuffer = Buffer.concat(chunks);
                const originalSize = finalBuffer.length;
                try {
                    // Bypass splitting when matrices compute static 1:1 mirroring
                    const shards = (K === 1 && N === 1) ? [finalBuffer] : await Bundler.encodeErasureShards(finalBuffer, K, N);
                    
                    const merkleRoots: string[] = [];
                    const CHUNK_SIZE = 64 * 1024; // 64KB Merkle tree boundaries

                    for (const shard of shards) {
                        const chunkBuffers: Buffer[] = [];
                        for (let offset = 0; offset < shard.length; offset += CHUNK_SIZE) {
                            chunkBuffers.push(shard.subarray(offset, Math.min(offset + CHUNK_SIZE, shard.length)));
                        }
                        const { root } = buildMerkleTree(chunkBuffers);
                        merkleRoots.push(root);
                    }
                    
                    resolve({
                        aesKey: key,
                        aesIv: iv,
                        authTag: getAuthTag().toString('hex'),
                        files,
                        shards,
                        originalSize,
                        merkleRoots
                    });
                } catch(e) { reject(e); }
            });

            archive.on('error', reject);
            cipherStream.on('error', reject);

            archive.pipe(cipherStream);

            for (let i = 0; i < uploadedFiles.length; i++) {
                const file = uploadedFiles[i];
                const filePath = sourcePaths[i] || file.originalname;
                let contentHash = "";
                
                if (file.path) {
                    contentHash = await new Promise<string>((res, rej) => {
                        const hash = crypto.createHash('sha256');
                        const st = fs.createReadStream(file.path);
                        let hashBytes = 0;
                        let lastHashEmit = 0;
                        st.on('data', (d: any) => {
                            hash.update(d);
                            hashBytes += d.length;
                            if (onProgress && hashBytes - lastHashEmit > 1024 * 512) {
                                lastHashEmit = hashBytes;
                                onProgress('HASH_ABSORPTION', `SHA-256 Stream Absorb [${file.originalname}]: ${hashBytes} bytes`, hashBytes);
                            }
                        });
                        st.on('end', () => {
                            if (onProgress && hashBytes > lastHashEmit) {
                                onProgress('HASH_ABSORPTION', `SHA-256 Stream Absorb [${file.originalname}]: ${hashBytes} bytes`, hashBytes);
                            }
                            const resHash = hash.digest('hex');
                            if (onProgress) onProgress('HASH_RESOLVED', `SHA-256 Content Validation Merkle Resolved: ${resHash}`, 0);
                            res(resHash);
                        });
                        st.on('error', rej);
                    });
                    files.push({ path: filePath, contentHash });
                    archive.append(fs.createReadStream(file.path), { name: filePath });
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
