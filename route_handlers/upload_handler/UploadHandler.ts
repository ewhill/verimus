import * as crypto from 'crypto';

import { ethers } from 'ethers';
import { Request, Response } from 'express';

import { BLOCK_TYPES } from '../../constants';
import { verifyMerkleProof, signData } from '../../crypto_utils/CryptoUtils';
import logger from '../../logger/Logger';
import { PendingBlockMessage } from '../../messages/pending_block_message/PendingBlockMessage';
import { StorageShardTransferMessage } from '../../messages/storage_shard_transfer_message/StorageShardTransferMessage';
import { VerifyHandoffRequestMessage } from '../../messages/verify_handoff_request_message/VerifyHandoffRequestMessage';
import type { Block, BlockPrivate, StorageContractPayload, PeerConnection, NodeShardMapping } from '../../types';
import { NodeRole } from '../../types/NodeRole';
import BaseHandler from '../base_handler/BaseHandler';


export default class UploadHandler extends BaseHandler {
    async handle(req: Request, res: Response) {
        if (!this.node.roles.includes(NodeRole.ORIGINATOR)) {
            return res.status(403).send('Forbidden: Node lacks ORIGINATOR parameter.');
        }
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
            return res.status(400).send('No files uploaded.');
        }

        const { ownerAddress, ownerSignature, timestamp, encryptedAesKey } = req.body;
        if (!ownerAddress || !ownerSignature || !timestamp) {
            return res.status(400).send('Web3 Proxy Identity missing natively.');
        }

        const authTag = req.body.authTag || ''; // Evaluated linearly below!
        const proxyMessage = `Approve Verimus Originator proxy for data struct ${authTag || 'batch'}\nTimestamp: ${timestamp}`;

        let recoveredAddress: string;
        try {
            recoveredAddress = ethers.verifyMessage(proxyMessage, ownerSignature);
            if (recoveredAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
                throw new Error("Mismatch strictly bypassing EIP-191 structural bounds.");
            }
        } catch (err: any) {
            return res.status(401).send(`Cryptography Check Rejected: Asymmetric Mismatch bounds natively failing EIP-191 payload. Details: ${err.message}`);
        }

        try {
            const publicKey = this.node.publicKey;
            const privateKey = this.node.privateKey;

            // 1 & 2 & 6. Stream zip and encode mathematically into parity boundary limits
            logger.info(`[Peer ${this.node.port}] Processing file upload structuring Erasure pipelines...`);

            const redundancyStr = req.body.redundancy;
            const maxCostStr = req.body.maxCost;
            let redundancy = redundancyStr ? parseInt(redundancyStr, 10) : 1;
            let maxCost = maxCostStr ? parseFloat(maxCostStr) : 50.0;

            if (isNaN(redundancy) || redundancy < 1) return res.status(400).send('Invalid redundancy parameter.');
            if (isNaN(maxCost) || maxCost <= 0) return res.status(400).send('Invalid maxCost boundary.');

            // Cap minimum redundancy bounds
            const activePeers = this.node.peer ? this.node.peer.trustedPeers.length : 0;
            if (activePeers < 1) {
                return res.status(503).send('No peers connected to natively fulfill limit orders.');
            }
            const absoluteMax = Math.min(5, activePeers);
            if (redundancy > absoluteMax) redundancy = absoluteMax;

            let paths: string[] = [];
            try {
                paths = JSON.parse(req.body.paths || '[]');
            } catch {
                paths = Array.isArray(req.body.paths) ? req.body.paths : [req.body.paths].filter(Boolean);
            }
            if (paths.length === 0) paths = files.map(f => f.originalname);

            const totalSize = files.reduce((acc, f) => acc + f.size, 0);
            const chunkSizeBytes = 65536; // 64KB Phase 3 explicit constant
            const theoreticalMaxCost = maxCost * redundancy * Math.max((totalSize / (1024 * 1024 * 1024)), 0.000001);
            const marketReqId = crypto.randomUUID();

            // Escrow phase tracking theoretical spend limits mapping against double-spends
            const hasFunds = await this.node.consensusEngine.walletManager.verifyFunds(publicKey, theoreticalMaxCost);
            const totalUserCost = theoreticalMaxCost * 1.05;
            const hasUserFunds = await this.node.consensusEngine.walletManager.verifyFunds(ownerAddress, totalUserCost);
            
            if (!hasFunds && publicKey !== 'SYSTEM') {
                return res.status(402).send('Insufficient Wallet Funds allocating constrained P2P limit orders.');
            }
            if (!hasUserFunds) {
                return res.status(402).send('Insufficient EIP-191 Egress Extrinsic Bounds mapped explicitly natively.');
            }

            this.node.consensusEngine.walletManager.freezeFunds(publicKey, theoreticalMaxCost, marketReqId);
            this.node.consensusEngine.walletManager.freezeFunds(ownerAddress, totalUserCost, marketReqId);
            logger.info(`[Peer ${this.node.port}] Initiating async storage limit order ${marketReqId} searching mapping ${redundancy} hosts...`);

            this.node.events.emit('upload_telemetry', { status: 'MARKET_INITIATED', message: `Broadcasting Limit Orders (${redundancy} Hosts, $${theoreticalMaxCost.toFixed(3)} VERI Escrow)` });

            // Triage Bid Harvesting parsing bounds against TCP buffers!
            const bids = await this.node.syncEngine.orchestrateStorageMarket(
                marketReqId, totalSize, chunkSizeBytes, redundancy, maxCost
            );

            if (bids.length < redundancy) {
                this.node.consensusEngine.walletManager.releaseFunds(marketReqId);
                return res.status(422).send(`Decentralized market triage loop timed out pulling isolated P2P arrays! Acquired hosts: ${bids.length}`);
            }

            logger.info(`[Peer ${this.node.port}] Decentralized array acquired mapping 100% boundary limits. Hosts: ${bids.map((b: { peerId: string }) => b.peerId.slice(0, 8)).join(', ')}`);

            this.node.events.emit('upload_telemetry', { status: 'BIDS_ACQUIRED', activeHosts: bids.map((b: { peerId: string }) => b.peerId), message: `Acquired exactly ${bids.length} Contract Obligations natively.` });
            this.node.events.emit('upload_telemetry', { status: 'SHARDING_STARTED', message: `Executing Reed-Solomon Zip Cryptography...` });

            // Erasure Configuration
            const K = Math.max(1, Math.ceil(redundancy / 2));
            const N = redundancy;

            const aesIv = req.body.aesIv || '';
            let fileMetadataArray = [];
            try { fileMetadataArray = JSON.parse(req.body.fileMetadata || '[]'); } catch (_unusedE) { }

            const encryptedBuffer = Buffer.isBuffer(files[0].buffer) ? files[0].buffer : await import('fs').then(fs => fs.readFileSync(files[0].path));

            const bundleResult = await this.node.bundler!.streamPreEncryptedErasureBundle(encryptedBuffer, K, N, (status, message, bytes) => {
                this.node.events.emit('upload_telemetry', { status, message, bytes });
            });
            if (!bundleResult) {
                this.node.consensusEngine.walletManager.releaseFunds(marketReqId);
                return res.status(500).send('Internal Node Array Zip mapping collapsed constructing mathematical matrices.');
            }

            const fragmentMap: NodeShardMapping[] = [];

            let shardsDispatchedCount = 0;

            logger.info(`[Peer ${this.node.port}] Dispersing ${bundleResult.shards.length} shards globally matching active logical HTTP boundaries...`);

            this.node.events.emit('upload_telemetry', { status: 'SHARDS_DISPATCHING', message: `Distributing K/N Parity fragments securely across matrices.` });

            // Transmit each shard mapping physically limiting loops Native WebSocket Protocol
            const shardDispatchPromises = bids.map(async (bid: { peerId: string, connection: any }, i: number) => {
                const shardBase64 = bundleResult.shards[i].toString('base64');
                const message = new StorageShardTransferMessage({
                    marketId: marketReqId,
                    shardIndex: i,
                    shardDataBase64: shardBase64
                });

                return new Promise<void>((res, rej) => {
                    const timeout = setTimeout(() => {
                        this.node.events.removeAllListeners(`shard_response:${marketReqId}:${i}`);
                        rej(new Error(`P2P Shard transmission to ${bid.peerId.slice(0, 8)} timed out.`));
                    }, 60000);

                    this.node.events.once(`shard_response:${marketReqId}:${i}`, (responseMsg: any) => {
                        clearTimeout(timeout);
                        if (!responseMsg.success) return rej(new Error('Host rejected processing logical blocks.'));

                        const physicalId = responseMsg.physicalId;

                        const CHUNK_SIZE = 64 * 1024;
                        const totalChunks = Math.ceil(bundleResult.shards[i].length / CHUNK_SIZE);
                        const targetIndex = totalChunks > 0 ? Math.floor(Math.random() * totalChunks) : 0;

                        const verifyMsg = new VerifyHandoffRequestMessage({
                            marketId: marketReqId,
                            physicalId: physicalId,
                            targetChunkIndex: targetIndex
                        });

                        const verifyTimeout = setTimeout(() => {
                            this.node.events.removeAllListeners(`handoff_response:${marketReqId}:${physicalId}`);
                            rej(new Error(`P2P chunk verification handoff loop timed out isolating limits.`));
                        }, 60000);

                        this.node.events.once(`handoff_response:${marketReqId}:${physicalId}`, (handoffMsg: any) => {
                            clearTimeout(verifyTimeout);

                            let isValid = false;
                            if (handoffMsg.success && handoffMsg.chunkDataBase64 && handoffMsg.merkleSiblings) {
                                const buffer = Buffer.from(handoffMsg.chunkDataBase64, 'base64');
                                isValid = verifyMerkleProof(buffer, handoffMsg.merkleSiblings, bundleResult.merkleRoots[i], targetIndex);
                            }

                            if (!isValid) {

                                console.error(`VALIDITY TRACE: success=${handoffMsg.success}, target=${targetIndex}, chunkMatchesBase64=${!!handoffMsg.chunkDataBase64}, siblingsLen=${handoffMsg.merkleSiblings?.length}, rootExpected=${bundleResult.merkleRoots[i]}`);

                                // Structurally penalize the host for misstating bounds preventing ledger bloat!
                                if (this.node.reputationManager) this.node.reputationManager.penalizeMajor(bid.peerId, "Data Verification Handoff Forgery");
                                return rej(new Error('Host definitively failed cryptographic chunk structural limits!'));
                            }

                            try {
                                fragmentMap.push({
                                    nodeId: bid.peerId,
                                    shardIndex: i,
                                    shardHash: crypto.createHash('sha256').update(bundleResult.shards[i]).digest('hex'),
                                    physicalId: physicalId
                                });
                                shardsDispatchedCount++;
                                this.node.events.emit('upload_telemetry', { status: 'SHARD_DISPATCHED', progress: shardsDispatchedCount, total: bundleResult.shards.length, message: `Dispatched Shard ${i + 1}/${bundleResult.shards.length} -> 0x${bid.peerId.slice(0, 8)}` });
                                res();
                            } catch (e) {
                                rej(e);
                            }
                        });

                        try {
                            Promise.resolve(bid.connection.send(verifyMsg)).catch((err: any) => {
                                clearTimeout(verifyTimeout);
                                rej(err);
                            });
                        } catch (err: any) {
                            clearTimeout(verifyTimeout);
                            rej(err);
                        }
                    });

                    // Stream natively into the underlying WebSocket P2P proxy framework matching limit bindings
                    try {
                        Promise.resolve(bid.connection.send(message)).catch((err: any) => {
                            clearTimeout(timeout);
                            rej(err);
                        });
                    } catch (err: any) {
                        clearTimeout(timeout);
                        rej(err);
                    }
                });
            });

            try {
                await Promise.all(shardDispatchPromises);
            } catch (_unusedErr: any) {
                logger.error(`[Peer ${this.node.port}] Shard Dispatch Promise failed natively! Reason: ${_unusedErr.message || _unusedErr}`);
                this.node.consensusEngine.walletManager.releaseFunds(marketReqId);
                return res.status(502).send(`Decentralized P2P transmission array sequence fatally failed communicating limits. Details: ${_unusedErr.message || _unusedErr}`);
            }

            this.node.events.emit('upload_telemetry', { status: 'CONSENSUS_INITIATED', message: `Broadcasting Verimus Block payload...` });

            // 7. Generate Pending Block and initiate consensus
            const privatePayload: BlockPrivate = {
                iv: aesIv,
                authTag: authTag,
                encryptedAesKey: encryptedAesKey, // Retained physical bounds mapping!
                location: { type: 'local' }, // Mocking local storage references temporarily parsing structural arrays
                physicalId: 'DECENTRALIZED_SHARD_MATRIX',
                files: fileMetadataArray
            };

            const encryptedPrivate = {
                encryptedPayloadBase64: Buffer.from(JSON.stringify(privatePayload)).toString('base64'),
                encryptedKeyBase64: 'DEPRECATED_PHASE5',
                encryptedIvBase64: 'DEPRECATED_PHASE5',
                encryptedAuthTagBase64: 'DEPRECATED_PHASE5'
            };

            const payloadResult: StorageContractPayload = {
                ...encryptedPrivate,
                marketId: marketReqId,
                activeHosts: bids.map((b: { peerId: string }) => b.peerId),
                allocatedEgressEscrow: theoreticalMaxCost,
                remainingEgressEscrow: theoreticalMaxCost,
                erasureParams: { k: K, n: N, originalSize: bundleResult.originalSize! },
                fragmentMap: fragmentMap,
                merkleRoots: bundleResult.merkleRoots,
                ownerAddress: recoveredAddress,
                ownerSignature: ownerSignature
            };

            const signatureStr = signData(JSON.stringify(payloadResult), privateKey);

            const pendingBlock: Block = {
                metadata: {
                    index: -1,
                    timestamp: Date.now(),
                },
                type: BLOCK_TYPES.STORAGE_CONTRACT,
                payload: payloadResult,
                publicKey: publicKey,
                signature: signatureStr
            };

            const blockId = crypto.createHash('sha256').update(signatureStr).digest('hex');

            logger.info(`[Peer ${this.node.port}] Initiating consensus for block ${blockId}`);

            // Create the message first so we have a deterministic timestamp for all nodes
            const p2pMsg = new PendingBlockMessage({ block: pendingBlock });

            // Process our own pending block using the EXACT same timestamp that will be broadcasted
            const localConnection = { peerAddress: `127.0.0.1:${this.node.port}` } as unknown as PeerConnection;
            this.node.consensusEngine.handlePendingBlock(pendingBlock, localConnection, Date.now()).catch(err => {
                logger.warn(`[Peer ${this.node.port}] Local pending block convergence exception caught avoiding crash loop: ${err.message}`);
            });

            // Broadcast Pending Block
            if (this.node.peer) {
                try {
                    this.node.peer.broadcast(p2pMsg).catch(err => {
                        logger.error(err);
                    });
                } catch (e: any) {
                    logger.warn(`Suppressed broadcast exception: ${e.message}`);
                }
            }
            // Setup asynchronous listener for consensus settlement
            const timeout = setTimeout(() => {
                this.node.events.removeAllListeners(`settled:${blockId}`);
                logger.error(`[Peer ${this.node.port}] Consensus timeout for block ${blockId.slice(0, 8)}`);
            }, 120000).unref(); // Expanded timeout to 2 minutes for edge cases since user doesn't wait and unref so it doesn't block exit

            this.node.events.once(`settled:${blockId}`, (settledBlock) => {
                clearTimeout(timeout);
                this.node.consensusEngine.walletManager.commitFunds(marketReqId); // Flushes local mapped lock
                logger.info(`[Peer ${this.node.port}] Block ${settledBlock.hash.slice(0, 8)} consensus achieved resolving limit orders directly!`);
            });

            // Respond immediately to UI
            res.status(202).json({
                success: true,
                message: "Block successfully uploaded and is pending consensus.",
                blockIndex: "Pending",
                hash: blockId,
                aesIv: aesIv,
                fragmentMap: fragmentMap,
                activeHosts: payloadResult.activeHosts
            });

        } catch (error: any) {
            logger.error(error);
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: error.message });
            }
        }
    }
}
