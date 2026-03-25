import crypto from 'crypto';
import { Transform } from 'stream';
import { Readable } from 'stream';

import { Request, Response } from 'express';

import Bundler from '../../bundler/Bundler';
import { verifySignature, decryptPrivatePayload, createAESDecryptStream } from '../../crypto_utils/CryptoUtils';
import logger from '../../logger/Logger';
import { StorageShardRetrieveRequestMessage } from '../../messages/storage_shard_retrieve_request_message/StorageShardRetrieveRequestMessage';
import type { StorageContractPayload } from '../../types';
import { NodeRole } from '../../types/NodeRole';
import BaseHandler from '../base_handler/BaseHandler';

export default class DownloadHandler extends BaseHandler {
    async handle(req: Request, res: Response) {
        if (!this.node.roles.includes(NodeRole.STORAGE)) {
            return res.status(403).send('Forbidden: Node lacks STORAGE parameter.');
        }

        const { hash } = req.params;

        try {
            const privateKey = this.node.privateKey;

            // Find block by hash
            const blocks = await this.node.ledger.collection!.find({ hash: hash }).toArray();
            if (blocks.length === 0) {
                return res.status(404).send('Block not found.');
            }
            const block = blocks[0];

            // Verify signature
            const isSignatureValid = verifySignature(JSON.stringify(block.payload), block.signature, block.publicKey);
            if (!isSignatureValid) {
                return res.status(401).send('Invalid block signature.');
            }

            // Decrypt private payload
            let privatePayload;
            try {
                privatePayload = decryptPrivatePayload(privateKey, block.payload as StorageContractPayload);
            } catch (e) {
                return res.status(401).send('Failed to decrypt private payload.');
            }

            let readStream: any;
            const payload = block.payload as StorageContractPayload;

            if (!payload.erasureParams) {
                const readStreamResult = await this.node.storageProvider!.getBlockReadStream(privatePayload.physicalId);
                if (readStreamResult.status === 'not_found') {
                    return res.status(404).send('Block not found.');
                }
                if (readStreamResult.status === 'pending') {
                    return res.status(202).send(readStreamResult.message || 'Retrieval initiated. Please check back later.');
                }

                if (req.query?.statusOnly === 'true') {
                    if (typeof (readStreamResult.stream as any)?.destroy === 'function') {
                        (readStreamResult.stream as any).destroy();
                    }
                    return res.status(200).send('Available');
                }
                readStream = readStreamResult.stream;
            } else {
                const requiredK = payload.erasureParams.k;
                const marketId = crypto.randomBytes(16).toString('hex');

                const fetchPromises = payload.fragmentMap!.map(async (mapping: any) => {
                    return new Promise<{ shardIndex: number, buffer: Buffer | null }>((resReq) => {
                        const timeout = setTimeout(() => {
                            this.node.events.removeAllListeners(`shard_retrieve:${marketId}:${mapping.physicalId}`);
                            resReq({ shardIndex: mapping.shardIndex, buffer: null });
                        }, 10000);

                        this.node.events.once(`shard_retrieve:${marketId}:${mapping.physicalId}`, (respMsg: any) => {
                            clearTimeout(timeout);
                            if (respMsg.success) resReq({ shardIndex: mapping.shardIndex, buffer: Buffer.from(respMsg.shardDataBase64, 'base64') });
                            else resReq({ shardIndex: mapping.shardIndex, buffer: null });
                        });

                        try {
                            if (mapping.nodeId === this.node.publicKey) {
                                this.node.storageProvider!.getBlockReadStream(mapping.physicalId).then(readRes => {
                                    if (readRes.status !== 'available' || !readRes.stream) {
                                        this.node.events.emit(`shard_retrieve:${marketId}:${mapping.physicalId}`, { success: false });
                                        return;
                                    }
                                    const chunks: Buffer[] = [];
                                    readRes.stream.on('data', c => chunks.push(c));
                                    readRes.stream.on('error', () => {
                                        this.node.events.emit(`shard_retrieve:${marketId}:${mapping.physicalId}`, { success: false });
                                    });
                                    readRes.stream.on('end', () => {
                                        const finalBuf = Buffer.concat(chunks);
                                        this.node.events.emit(`shard_retrieve:${marketId}:${mapping.physicalId}`, { success: true, shardDataBase64: finalBuf.toString('base64') });
                                    });
                                }).catch(() => {
                                    this.node.events.emit(`shard_retrieve:${marketId}:${mapping.physicalId}`, { success: false });
                                });
                            } else {
                                const reqMsg = new StorageShardRetrieveRequestMessage({ marketId, physicalId: mapping.physicalId });
                                const activeConnection = this.node.peer!.connectedPeers.find(c => c.remotePublicKey === mapping.nodeId);
                                if (activeConnection) activeConnection.send(reqMsg);
                                else {
                                    if (this.node.peer!.connectedPeers.length === 0) {
                                        this.node.events.emit(`shard_retrieve:${marketId}:${mapping.physicalId}`, { success: false });
                                    } else {
                                        clearTimeout(timeout); resReq({ shardIndex: mapping.shardIndex, buffer: null });
                                    }
                                }
                            }
                        } catch (e) {
                            clearTimeout(timeout);
                            resReq({ shardIndex: mapping.shardIndex, buffer: null });
                        }
                    });
                });

                const rawResults = await Promise.all(fetchPromises);

                const N = payload.erasureParams.n;
                const shardsInput = new Array(N).fill(null);
                let validCount = 0;

                for (const res of rawResults) {
                    if (res.buffer) {
                        shardsInput[res.shardIndex] = res.buffer;
                        validCount++;
                    }
                }

                if (validCount < requiredK) {
                    return res.status(502).send('Insufficient redundant shards available enforcing mathematical boundaries.');
                }

                const reconstructed = await Bundler.reconstructErasureShards(
                    shardsInput,
                    payload.erasureParams.k,
                    payload.erasureParams.n,
                    payload.erasureParams.originalSize
                );

                readStream = Readable.from(reconstructed.subarray(0, payload.erasureParams.originalSize));
            }

            const decipher = createAESDecryptStream(privatePayload.key, privatePayload.iv, privatePayload.authTag);

            res.setHeader('Content-disposition', `attachment; filename=block_${hash}.zip`);
            res.setHeader('Content-type', 'application/zip');

            const egressCostPerGB = this.node.storageProvider!.getEgressCostPerGB() ?? 0;
            let accumulatedCost = 0;
            const maxEscrow = privatePayload.remainingEgressEscrow ?? privatePayload.allocatedEgressEscrow ?? 0;

            const byteSpooler = new Transform({
                transform(chunk, encoding, callback) {
                    if (egressCostPerGB > 0) {
                        const iterationCost = (chunk.length / (1024 * 1024 * 1024)) * egressCostPerGB;
                        accumulatedCost += iterationCost;

                        if (accumulatedCost > maxEscrow) {
                            return callback(new Error('Bandwidth escrow exhausted. Payment Required.'));
                        }
                    }
                    callback(null, chunk);
                }
            });

            readStream.on('error', (err: any) => {
                logger.error('ReadStream Error:', err);
                if (!res.headersSent) res.status(500).send('Error reading block.');
            });

            decipher.on('error', (err: any) => {
                logger.error('Decipher Error:', err);
                if (!res.headersSent) res.status(500).send('Decryption failed, check your keys.');
            });

            byteSpooler.on('error', (err: any) => {
                logger.warn(`Egress cutoff triggered: ${err.message}`);
                if (!res.headersSent) res.status(402).send(err.message);
                else res.end();

                if (typeof (readStream as any).destroy === 'function') {
                    (readStream as any).destroy();
                }
            });

            res.on('close', async () => {
                if (accumulatedCost > 0) {
                    const resolvedHash = Array.isArray(hash) ? hash[0] : hash;
                    await this.node.consensusEngine?.walletManager?.deductEgressEscrow(resolvedHash, accumulatedCost);
                }
            });

            // Pipe storage -> bill tracking -> decrypt -> response
            readStream.pipe(byteSpooler).pipe(decipher).pipe(res);

        } catch (error) {
            logger.error(error as Error);
            if (!res.headersSent) {
                res.status(500).send('Server Error Processing Download');
            }
        }
    }
}
