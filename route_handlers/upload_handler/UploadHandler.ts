import * as crypto from 'crypto';

import { ethers } from 'ethers';
import { Request, Response } from 'express';

import { BLOCK_TYPES, AVERAGE_BLOCK_TIME_MS } from '../../constants';
import { verifyMerkleProof } from '../../crypto_utils/CryptoUtils';
import { EIP712_DOMAIN, EIP712_SCHEMAS, normalizeBlockForSignature } from '../../crypto_utils/EIP712Types';
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
        const proxyMessage = `Approve Verimus Originator proxy for data struct batch\nTimestamp: ${timestamp}`;

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
            const signerAddress = this.node.walletAddress;
            // Removed unused RSA privateKey hook

            // 1 & 2 & 6. Stream zip and encode mathematically into parity boundary limits
            logger.info(`[Peer ${this.node.port}] Processing file upload structuring Erasure pipelines...`);

            const redundancyStr = req.body.redundancy;
            const maxCostStr = req.body.maxCost;
            const targetDurationHoursStr = req.body.targetDurationHours;
            let redundancy = redundancyStr ? parseInt(redundancyStr, 10) : 1;
            let maxCost = maxCostStr ? parseFloat(maxCostStr) : 50.0;
            let targetDurationHours = targetDurationHoursStr ? parseFloat(targetDurationHoursStr) : 24.0;

            if (isNaN(redundancy) || redundancy < 1) return res.status(400).send('Invalid redundancy parameter.');
            if (isNaN(maxCost) || maxCost <= 0) return res.status(400).send('Invalid maxCost boundary.');
            if (isNaN(targetDurationHours) || targetDurationHours <= 0) return res.status(400).send('Invalid target duration boundary.');

            // Cap minimum redundancy bounds natively mathematically isolating physical vectors
            const activePeers = this.node.peer ? this.node.peer.peers.length : 0;
            if (activePeers < 1) {
                return res.status(503).send('No peers connected to natively fulfill limit orders.');
            }
            if (redundancy > 20) redundancy = 20;

            let paths: string[] = [];
            try {
                paths = JSON.parse(req.body.paths || '[]');
            } catch {
                paths = Array.isArray(req.body.paths) ? req.body.paths : [req.body.paths].filter(Boolean);
            }
            if (paths.length === 0) paths = files.map(f => f.originalname);

            const totalSize = files.reduce((acc, f) => acc + (f.size || 1024), 0);
            const chunkSizeBytes = 65536; // 64KB Phase 3 explicit constant
            
            // Egress upfront logic limits
            const theoreticalMaxCost = Math.ceil(maxCost * redundancy * Math.max((totalSize / (1024 * 1024 * 1024)), 0.000001));
            const theoreticalMaxCostWei = ethers.parseUnits(theoreticalMaxCost.toString(), 18);
            
            // Chronological rest-toll limits mapping dynamically
            const targetDurationBlocks = Math.ceil((targetDurationHours * 3600 * 1000) / AVERAGE_BLOCK_TIME_MS);
            
            // Parse pricing organically safely falling back securely mapped if unconfigured
            const extConfig = this.node as any;
            const restTollPerGBHour = extConfig.config?.pricing?.restTollPerGBHour || 1.5;
            
            const expectedSizeGB = Math.max((totalSize / (1024 * 1024 * 1024)), 0.000001);
            const chronologicalCost = Math.ceil(expectedSizeGB * restTollPerGBHour * targetDurationHours * redundancy);
            const allocatedRestTollWei = ethers.parseUnits(chronologicalCost.toString(), 18);
            
            const marketReqId = crypto.randomUUID();

            const currentActiveBlock = await this.node.ledger.getLatestBlock();
            const currentBlockIndex = currentActiveBlock?.metadata?.index || 0;
            const startBlockHeight = BigInt(currentBlockIndex);
            const expirationBlockHeight = startBlockHeight + BigInt(targetDurationBlocks);

            // Escrow phase tracking theoretical spend limits mapping against double-spends
            const requiredTotalWei = theoreticalMaxCostWei + allocatedRestTollWei;
            const hasFunds = await this.node.consensusEngine.walletManager.verifyFunds(signerAddress, requiredTotalWei);
            const totalUserCost = Math.ceil((theoreticalMaxCost + chronologicalCost) * 1.05);
            const totalUserCostWei = ethers.parseUnits(totalUserCost.toString(), 18);
            
            const currentBalance = await this.node.consensusEngine.walletManager.calculateBalance(ownerAddress);
            logger.error(`[UploadHandler] DEBUG: ownerAddress: ${ownerAddress}, totalUserCostWei: ${totalUserCostWei}, currentBalance: ${currentBalance}, redundancy: ${redundancy}, maxCost: ${maxCost}, totalSize: ${totalSize}`);
            
            const hasUserFunds = await this.node.consensusEngine.walletManager.verifyFunds(ownerAddress, totalUserCostWei);
            
            if (!hasFunds && signerAddress !== ethers.ZeroAddress) {
                return res.status(402).send('Insufficient Wallet Funds allocating constrained P2P limit orders.');
            }
            if (!hasUserFunds) {
                return res.status(402).send('Insufficient EIP-191 Egress Extrinsic Bounds mapped explicitly natively.');
            }

            this.node.consensusEngine.walletManager.freezeFunds(signerAddress, theoreticalMaxCostWei, marketReqId, allocatedRestTollWei, startBlockHeight, expirationBlockHeight);
            this.node.consensusEngine.walletManager.freezeFunds(ownerAddress, totalUserCostWei, marketReqId, allocatedRestTollWei, startBlockHeight, expirationBlockHeight);
            logger.info(`[Peer ${this.node.port}] Initiating async storage limit order ${marketReqId} searching mapping ${redundancy} hosts...`);

            this.node.events.emit('upload_telemetry', { status: 'MARKET_INITIATED', message: `Broadcasting Limit Orders (${redundancy} Hosts, $${theoreticalMaxCost.toFixed(3)} VERI Escrow)` });

            // Triage Bid Harvesting parsing bounds against TCP buffers!
            const bids = await this.node.syncEngine.orchestrateStorageMarket(
                marketReqId, totalSize, chunkSizeBytes, redundancy, maxCost, targetDurationBlocks, allocatedRestTollWei.toString()
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
            const shardDispatchPromises = bids.slice(0, redundancy).map(async (bid: { peerId: string, connection: any }, i: number) => {
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
                                    shardIndex: BigInt(i),
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
                allocatedEgressEscrow: theoreticalMaxCostWei,
                remainingEgressEscrow: theoreticalMaxCostWei,
                erasureParams: { k: BigInt(K), n: BigInt(N), originalSize: BigInt(bundleResult.originalSize!) },
                fragmentMap: fragmentMap,
                merkleRoots: bundleResult.merkleRoots,
                ownerAddress: recoveredAddress,
                ownerSignature: ownerSignature,
                brokerFeePercentage: BigInt(Math.floor((this.node.proxyBrokerFee || 0) * 10000))
            };

            const valBlock: Block = {
                metadata: {
                    index: -1,
                    timestamp: Date.now(),
                },
                type: BLOCK_TYPES.STORAGE_CONTRACT,
                payload: payloadResult,
                signerAddress: signerAddress,
                previousHash: '',
                signature: ''
            };
            
            const valueObj = normalizeBlockForSignature(valBlock);
            const schema = EIP712_SCHEMAS[BLOCK_TYPES.STORAGE_CONTRACT];
            
            valBlock.signature = await this.node.wallet!.signTypedData(EIP712_DOMAIN, schema, valueObj.payload ? valueObj : valueObj);
            
            const pendingBlock = valBlock;

            const blockToHash = { ...pendingBlock };
            delete blockToHash.hash;
            // @ts-ignore
            delete (blockToHash as any)._id;
            const blockId = crypto.createHash('sha256').update(JSON.stringify(blockToHash)).digest('hex');

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
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    this.node.events.removeAllListeners(`settled:${blockId}`);
                    this.node.events.removeAllListeners(`failed:${blockId}`);
                    logger.error(`[Peer ${this.node.port}] Consensus timeout for block ${blockId.slice(0, 8)}`);
                    reject(new Error("Network timing constraint exceeded waiting for verifiable block quorum securely!"));
                }, 140000);

                this.node.events.once(`settled:${blockId}`, (settledBlock) => {
                    clearTimeout(timeout);
                    this.node.events.removeAllListeners(`failed:${blockId}`);
                    this.node.consensusEngine.walletManager.commitFunds(marketReqId);
                    logger.info(`[Peer ${this.node.port}] Block ${settledBlock.hash.slice(0, 8)} consensus achieved resolving limit orders directly!`);
                    resolve(settledBlock);
                });

                this.node.events.once(`failed:${blockId}`, () => {
                    clearTimeout(timeout);
                    this.node.events.removeAllListeners(`settled:${blockId}`);
                    reject(new Error("Decentralized P2P mesh fundamentally rejected quorum constraints locally! Block dropped."));
                });
            });

            res.status(200).json({
                success: true,
                message: "Block successfully uploaded and gained consensus on the ledger.",
                blockIndex: "Settled",
                hash: blockId,
                aesIv: aesIv,
                fragmentMap: fragmentMap,
                activeHosts: payloadResult.activeHosts
            });

        } catch (error: any) {
            logger.error(error);
            console.error("UPLOAD ERROR IN HANDLER:", error);
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: error.message });
            }
        }
    }
}
