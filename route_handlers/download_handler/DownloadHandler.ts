import crypto from 'crypto';
import { Transform } from 'stream';
import { Readable } from 'stream';

import { ethers } from 'ethers';
import { Request, Response } from 'express';

import Bundler from '../../bundler/Bundler';
import { verifyEIP712BlockSignature } from '../../crypto_utils/CryptoUtils';
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

            // Find block by hash
            const blocks = await this.node.ledger.collection!.find({ hash: hash }).toArray();
            if (blocks.length === 0) {
                return res.status(404).send('Block not found.');
            }
            const block = blocks[0];

            // Verify signature
            const isSignatureValid = verifyEIP712BlockSignature(block);
            if (!isSignatureValid) {
                logger.warn('DownloadHandler: Invalid block signature.');
                return res.status(401).send('Invalid block signature.');
            }

        // Web3 Identity Decoupling (Phase 5)
        const web3Address = req.headers['x-web3-address'] as string;
        const web3Timestamp = req.headers['x-web3-timestamp'] as string;
        const web3Signature = req.headers['x-web3-signature'] as string;

        if (!web3Address || !web3Timestamp || !web3Signature) {
            return res.status(401).send('Missing EIP-191 Web3 Identity mapping explicitly.');
        }

        const now = Date.now();
        if (now - parseInt(web3Timestamp) > 5 * 60 * 1000) {
            return res.status(401).send('Web3 EIP-191 Signature expired structurally.');
        }

        const payload = block.payload as StorageContractPayload;
        if (!payload || !payload.ownerAddress || payload.ownerAddress.toLowerCase() !== web3Address.toLowerCase()) {
            return res.status(403).send('Web3 Identity mismatch natively against Storage Matrix logic.');
        }

        try {
            const expectedMessage = JSON.stringify({ action: 'download', blockHash: hash, timestamp: web3Timestamp });
            const recoveredAddress = ethers.verifyMessage(expectedMessage, web3Signature);
            if (recoveredAddress.toLowerCase() !== web3Address.toLowerCase()) {
                return res.status(401).send('Invalid EIP-191 explicit resolution structurally mapped array bounds.');
            }
        } catch (_unusedE) {
            return res.status(401).send('Cryptographic signature explicitly invalid mechanically.');
        }

        let privatePayload;
        try {
            privatePayload = JSON.parse(Buffer.from(payload.encryptedPayloadBase64, 'base64').toString('utf8'));
        } catch (_unusedE) {
            return res.status(500).send('Failed parsing decoupled base64 matrix statically');
        }

        let readStream: any;

            if (!payload.erasureParams) {
                const readStreamResult = await this.node.storageProvider!.getBlockReadStream(privatePayload.physicalId);
                if (readStreamResult.status === 'not_found') {
                    return res.status(404).send('Block not found.');
                }
                if (readStreamResult.status === 'pending') {
                    return res.status(202).send(readStreamResult.message || 'Retrieval initiated. Please check back later.');
                }

                if (req.query?.statusOnly === 'true') {
                    readStreamResult.stream.destroy();
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
                            if (mapping.nodeId === this.node.walletAddress) {
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
                        } catch (_unusedE) {
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

            res.setHeader('Content-disposition', `attachment; filename=block_${hash}.enc`);
            res.setHeader('Content-type', 'application/octet-stream');

            const egressCostPerGB = this.node.storageProvider!.getEgressCostPerGB() ?? 0;
            let accumulatedCost = 0;
            const maxEscrow = privatePayload.remainingEgressEscrow ?? privatePayload.allocatedEgressEscrow ?? 0;

            const byteSpooler = new Transform({
                transform(chunk, _unusedEncoding, callback) {
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

            byteSpooler.on('error', (err: any) => {
                logger.warn(`Egress cutoff triggered: ${err.message}`);
                if (!res.headersSent) res.status(402).send(err.message);
                else res.end();

                if (readStream) {
                    readStream.destroy();
                }
            });

            res.on('close', async () => {
                if (accumulatedCost > 0) {
                    const resolvedHash = Array.isArray(hash) ? hash[0] : hash;
                    await this.node.consensusEngine?.walletManager?.deductEgressEscrow(resolvedHash, accumulatedCost);
                }
            });

            // Pipe storage -> bill tracking -> response natively (Client-Side decrypts)
            readStream.pipe(byteSpooler).pipe(res);

        } catch (error) {
            logger.error(error as Error);
            if (!res.headersSent) {
                res.status(500).send('Server Error Processing Download');
            }
        }
    }
}
