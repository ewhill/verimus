import * as cryptoUtils from '../../crypto_utils/CryptoUtils';
import logger from '../../logger/Logger';
import { BlockSyncRequestMessage } from '../../messages/block_sync_request_message/BlockSyncRequestMessage';
import { BlockSyncResponseMessage } from '../../messages/block_sync_response_message/BlockSyncResponseMessage';
import { ChainStatusRequestMessage } from '../../messages/chain_status_request_message/ChainStatusRequestMessage';
import { ChainStatusResponseMessage } from '../../messages/chain_status_response_message/ChainStatusResponseMessage';
import { MerkleProofChallengeRequestMessage } from '../../messages/merkle_proof_challenge_request_message/MerkleProofChallengeRequestMessage';
import { MerkleProofChallengeResponseMessage } from '../../messages/merkle_proof_challenge_response_message/MerkleProofChallengeResponseMessage';
import { NetworkHealthSyncMessage } from '../../messages/network_health_sync_message/NetworkHealthSyncMessage';
import { StorageBidMessage } from '../../messages/storage_bid_message/StorageBidMessage';
import { StorageRequestMessage } from '../../messages/storage_request_message/StorageRequestMessage';
import { StorageShardResponseMessage } from '../../messages/storage_shard_response_message/StorageShardResponseMessage';
import { StorageShardRetrieveRequestMessage } from '../../messages/storage_shard_retrieve_request_message/StorageShardRetrieveRequestMessage';
import { StorageShardRetrieveResponseMessage } from '../../messages/storage_shard_retrieve_response_message/StorageShardRetrieveResponseMessage';
import { StorageShardTransferMessage } from '../../messages/storage_shard_transfer_message/StorageShardTransferMessage';
import { VerifyHandoffRequestMessage } from '../../messages/verify_handoff_request_message/VerifyHandoffRequestMessage';
import { VerifyHandoffResponseMessage } from '../../messages/verify_handoff_response_message/VerifyHandoffResponseMessage';
import PeerNode from '../../peer_node/PeerNode';
import type { Block, PeerConnection } from '../../types';
import { NodeRole } from '../../types/NodeRole';

export interface SyncBufferEvent {
    type: 'PendingBlock' | 'AdoptFork' | 'ProposeFork';
    block?: Block;
    connection: PeerConnection;
    timestamp?: number;
    forkId?: string;
    blockIds?: string[];
    finalTipHash?: string;
}

export interface ChainStatusResponse {
    latestIndex: number;
    latestHash: string;
    connection: PeerConnection;
}

/**
 * @typedef {import('../types').PeerConnection} PeerConnection
 * @typedef {import('../types').Block} Block
 */

class SyncEngine {
    node: PeerNode;
    isSyncing: boolean;
    syncBuffer: SyncBufferEvent[];
    _chainStatusResponses: { latestIndex: number, latestHash: string, connection: PeerConnection }[];
    _blockSyncResponses: Map<string, Block>;
    spamTracker: Map<string, number[]>;
    syncInterval: NodeJS.Timeout | null = null;
    activeStorageMarkets: Map<string, {
        bids: { peerId: string, cost: number, uptime: number, connection: PeerConnection }[],
        requiredNodes: number,
        maxCostPerGB: number,
        resolve: (bids: any[]) => void
    }>;

    constructor(node: PeerNode) {
        this.node = node;
        this.isSyncing = false;
        this.syncBuffer = [];
        this._chainStatusResponses = [];
        this._blockSyncResponses = new Map();
        this.spamTracker = new Map();
        this.activeStorageMarkets = new Map();
    }

    bindHandlers() {
        this.node.peer?.bind(ChainStatusRequestMessage).to(async (_unusedM: ChainStatusRequestMessage, c: PeerConnection) => this.handleChainStatusRequest(c));
        this.node.peer?.bind(ChainStatusResponseMessage).to(async (m: ChainStatusResponseMessage, c: PeerConnection) => this.handleChainStatusResponse(m.latestIndex, m.latestHash, c));
        this.node.peer?.bind(BlockSyncRequestMessage).to(async (m: BlockSyncRequestMessage, c: PeerConnection) => this.handleBlockSyncRequest(m.index, c));
        this.node.peer?.bind(BlockSyncResponseMessage).to(async (m: BlockSyncResponseMessage, c: PeerConnection) => this.handleBlockSyncResponse(m.block, c));
        this.node.peer?.bind(NetworkHealthSyncMessage).to(async (m: NetworkHealthSyncMessage, c: PeerConnection) => this.handleNetworkHealthSync(m.score_payloads, c));
        this.node.peer?.bind(StorageRequestMessage).to(async (m: StorageRequestMessage, c: PeerConnection) => this.handleStorageRequest(m, c));
        this.node.peer?.bind(StorageBidMessage).to(async (m: StorageBidMessage, c: PeerConnection) => this.handleStorageBid(m, c));
        this.node.peer?.bind(StorageShardTransferMessage).to(async (m: StorageShardTransferMessage, c: PeerConnection) => this.handleStorageShardTransfer(m, c));
        this.node.peer?.bind(StorageShardResponseMessage).to(async (m: StorageShardResponseMessage, c: PeerConnection) => this.handleStorageShardResponse(m, c));
        this.node.peer?.bind(StorageShardRetrieveRequestMessage).to(async (m: StorageShardRetrieveRequestMessage, c: PeerConnection) => this.handleStorageShardRetrieveRequest(m, c));
        this.node.peer?.bind(StorageShardRetrieveResponseMessage).to(async (m: StorageShardRetrieveResponseMessage, c: PeerConnection) => this.handleStorageShardRetrieveResponse(m, c));
        this.node.peer?.bind(VerifyHandoffRequestMessage).to(async (m: VerifyHandoffRequestMessage, c: PeerConnection) => this.handleVerifyHandoffRequest(m, c));
        this.node.peer?.bind(VerifyHandoffResponseMessage).to(async (m: VerifyHandoffResponseMessage, c: PeerConnection) => this.handleVerifyHandoffResponse(m, c));
        this.node.peer?.bind(MerkleProofChallengeRequestMessage).to(async (m: MerkleProofChallengeRequestMessage, c: PeerConnection) => this.handleMerkleProofChallengeRequest(m, c));
        this.node.peer?.bind(MerkleProofChallengeResponseMessage).to(async (m: MerkleProofChallengeResponseMessage, c: PeerConnection) => this.handleMerkleProofChallengeResponse(m, c));

        // Start native background tracking
        if (this.node.peer) {
            this.syncInterval = setInterval(async () => {
                if (!this.node.ledger.peersCollection) return;
                const peers = await this.node.ledger.peersCollection.find({}).toArray();
                const score_payloads = peers.map(p => ({ publicKey: p.publicKey, score: p.score, roles: p.roles }));
                
                // Also broadcast our own native node roles mapped
                score_payloads.push({ publicKey: this.node.publicKey, score: 100, roles: this.node.roles });
                if (score_payloads.length > 0) {
                    this.node.peer!.broadcast(new NetworkHealthSyncMessage({ score_payloads })).catch(() => {});
                }
            }, 60000);
        }
    }

    async handleNetworkHealthSync(score_payloads: { publicKey: string, score: number, roles?: NodeRole[] }[], _unusedConnection: PeerConnection) {
        if (!this.node.ledger.peersCollection) return;
        
        for (const remoteScore of score_payloads) {
            const localPeer = await this.node.ledger.peersCollection.findOne({ publicKey: remoteScore.publicKey });
            if (localPeer) {
                // Drift Fix: Preserve internal cutoff bounds if local score is drastically lower (Sybil defense)
                if (localPeer.isBanned || localPeer.score === 0) continue; // Banned locally, permanently isolated
                if (localPeer.score < remoteScore.score && (remoteScore.score - localPeer.score) > 20) {
                    continue; // Discard whitewashing attempts preserving underlying local bounds
                }

                // Assert aggregation ignoring 0 swings 
                if (remoteScore.score === 0) continue;
                
                let updatedScore = Math.floor((localPeer.score + remoteScore.score) / 2);
                if (updatedScore > 100) updatedScore = 100;
                if (updatedScore < 0) updatedScore = 0;
                
                if (updatedScore !== localPeer.score || (remoteScore.roles && JSON.stringify(localPeer.roles) !== JSON.stringify(remoteScore.roles))) {
                    await this.node.ledger.peersCollection.updateOne(
                        { publicKey: remoteScore.publicKey },
                        { $set: { score: updatedScore, isBanned: updatedScore === 0, ...(remoteScore.roles ? { roles: remoteScore.roles } : {}) } }
                    );
                }
            } else if (remoteScore.score > 0) {
                // ingest new metrics tracking
                await this.node.ledger.peersCollection.insertOne({
                     publicKey: remoteScore.publicKey,
                     score: Math.min(remoteScore.score, 100),
                     strikeCount: 0,
                     isBanned: false,
                     lastOffense: null,
                     roles: remoteScore.roles || []
                 });
            }
        }
    }

    async handleChainStatusRequest(connection: PeerConnection) {
        let pubKey = connection.remoteCredentials_?.rsaKeyPair?.public?.toString('utf8');
        if (pubKey) {
            const now = Date.now();
            let timestamps = this.spamTracker.get(pubKey) || [];
            timestamps = timestamps.filter(t => now - t < 5000); // keep requests within the last 5 seconds
            timestamps.push(now);
            this.spamTracker.set(pubKey, timestamps);
            
            if (timestamps.length > 4) { // 5 requests within 5 seconds = spam
                logger.warn(`[Peer ${this.node.port}] P2P Spam detected from ${connection.peerAddress}`);
                await this.node.reputationManager.penalizeMinor(pubKey, "P2P Spam");
                this.spamTracker.set(pubKey, []); // Reset to prevent spamming logs
                return; // Drop request
            }
        }

        const latestBlock = await this.node.ledger.getLatestBlock();
        if (latestBlock) {
            connection.send(new ChainStatusResponseMessage({ latestIndex: latestBlock.metadata.index, latestHash: latestBlock.hash }));
        }
    }

    async handleChainStatusResponse(latestIndex: number, latestHash: string, connection: PeerConnection) {
        if (this.isSyncing && this._chainStatusResponses) {
            this._chainStatusResponses.push({ latestIndex, latestHash, connection });
        }
    }

    async handleBlockSyncRequest(index: number, connection: PeerConnection) {
        const block = await this.node.ledger.getBlockByIndex(index);
        if (block) {
            connection.send(new BlockSyncResponseMessage({ block }));
        }
    }

    async handleBlockSyncResponse(block: Block, connection: PeerConnection) {
        if (this.isSyncing && this._blockSyncResponses) {
            const key = `${block.metadata.index}_${connection.peerAddress}`;
            this._blockSyncResponses.set(key, block);
        }
    }

    async orchestrateStorageMarket(requestId: string, fileSizeBytes: number, chunkSizeBytes: number, requiredNodes: number, maxCostPerGB: number): Promise<any[]> {
        // Broadcast the limit order globally across the swarm
        this.activeStorageMarkets.set(requestId, {
            bids: [],
            requiredNodes,
            maxCostPerGB,
            resolve: () => {}
        });

        const reqMsg = new StorageRequestMessage({
            storageRequestId: requestId,
            fileSizeBytes,
            chunkSizeBytes,
            requiredNodes,
            maxCostPerGB,
            senderId: this.node.publicKey
        });
        
        await this.node.peer!.broadcast(reqMsg);

        return new Promise((resolve) => {
            const market = this.activeStorageMarkets.get(requestId)!;
            
            let timer: NodeJS.Timeout | undefined;

            market.resolve = (bids: any) => {
                if (timer) clearTimeout(timer);
                resolve(bids);
            };

            timer = setTimeout(() => {
                const finalMarket = this.activeStorageMarkets.get(requestId);
                if (finalMarket) {
                    finalMarket.resolve(finalMarket.bids);
                    this.activeStorageMarkets.delete(requestId);
                }
            }, 30000); // 30 second maximum timeout boundary
        });
    }

    async handleStorageRequest(msg: StorageRequestMessage, connection: PeerConnection) {
        if (this.node.peer) this.node.peer.broadcast(msg).catch(()=>{});

        // Only valid if this node operates the STORAGE role
        if (!this.node.roles.includes(NodeRole.STORAGE)) return;

        // Ensure we are not bidding on our own packets mapping isolated networks
        if (msg.senderId === this.node.publicKey) return;

        // Check if we can beat the maxCost limit
        const egressCost = this.node.storageProvider?.getEgressCostPerGB ? this.node.storageProvider.getEgressCostPerGB() : 0.00;
        if (egressCost > msg.maxCostPerGB) return; // Drop request

        // Formulate returning Bid payload successfully 
        const bidMsg = new StorageBidMessage({
            storageRequestId: msg.storageRequestId,
            storageHostId: this.node.publicKey,
            proposedCostPerGB: egressCost,
            guaranteedUptimeMs: 86400000 // Mock 24h guarantee for now mappings
        });

        connection.send(bidMsg);
    }

    async handleStorageBid(msg: StorageBidMessage, connection: PeerConnection) {
        const market = this.activeStorageMarkets.get(msg.storageRequestId);
        if (!market) return; // Invalid or expired order

        // If cost exceeds our strict ceiling limit order mappings drop it
        if (msg.proposedCostPerGB > market.maxCostPerGB) return;

        // Record the limit order bid
        market.bids.push({
            peerId: msg.storageHostId,
            cost: msg.proposedCostPerGB,
            uptime: msg.guaranteedUptimeMs,
            connection
        });

        // Triage Cutoff logic! If array hits 'N' required limit boundaries exactly stop the timer early!
        if (market.bids.length >= market.requiredNodes) {
             market.resolve(market.bids);
             this.activeStorageMarkets.delete(msg.storageRequestId);
        }
    }

    async handleStorageShardTransfer(msg: StorageShardTransferMessage, connection: PeerConnection) {
        if (!this.node.roles.includes(NodeRole.STORAGE)) return;

        try {
            const { physicalBlockId, writeStream } = this.node.storageProvider!.createBlockStream();
            
            const buffer = Buffer.from(msg.shardDataBase64, 'base64');
            writeStream.end(buffer);

            await new Promise((res, rej) => {
                writeStream.on('finish', res);
                writeStream.on('error', rej);
            });

            const responseMsg = new StorageShardResponseMessage({
                marketId: msg.marketId,
                shardIndex: msg.shardIndex,
                physicalId: physicalBlockId,
                success: true
            });
            connection.send(responseMsg);

        } catch (error: any) {
            logger.error(`[Peer ${this.node.port}] Failed to process shard transfer boundaries natively: ${error.message}`);
            connection.send(new StorageShardResponseMessage({
                marketId: msg.marketId,
                shardIndex: msg.shardIndex,
                physicalId: '',
                success: false
            }));
        }
    }

    async handleStorageShardResponse(msg: StorageShardResponseMessage, _unusedConnection: PeerConnection) {
        this.node.events.emit(`shard_response:${msg.marketId}:${msg.shardIndex}`, msg);
    }

    async handleStorageShardRetrieveRequest(msg: StorageShardRetrieveRequestMessage, connection: PeerConnection) {
        if (!this.node.roles.includes(NodeRole.STORAGE)) return;

        try {
            const result = await this.node.storageProvider!.getBlockReadStream(msg.physicalId);
            if (result.status !== 'available' || !result.stream) {
                return connection.send(new StorageShardRetrieveResponseMessage({
                     physicalId: msg.physicalId, marketId: msg.marketId, shardDataBase64: '', success: false
                }));
            }
            const chunks: Buffer[] = [];
            result.stream.on('data', (c: Buffer) => chunks.push(c));
            result.stream.on('error', () => {
                connection.send(new StorageShardRetrieveResponseMessage({
                     physicalId: msg.physicalId, marketId: msg.marketId, shardDataBase64: '', success: false
                }));
            });
            result.stream.on('end', () => {
                const finalBuffer = Buffer.concat(chunks);
                connection.send(new StorageShardRetrieveResponseMessage({
                     physicalId: msg.physicalId, marketId: msg.marketId, shardDataBase64: finalBuffer.toString('base64'), success: true
                }));
            });
        } catch (error: any) {
            logger.error(`[Peer ${this.node.port}] Failed to retrieve shard physically mapping logic constraints: ${error.message}`);
            connection.send(new StorageShardRetrieveResponseMessage({
                 physicalId: msg.physicalId, marketId: msg.marketId, shardDataBase64: '', success: false
            }));
        }
    }

    async handleStorageShardRetrieveResponse(msg: StorageShardRetrieveResponseMessage, _unusedConnection: PeerConnection) {
        this.node.events.emit(`shard_retrieve:${msg.marketId}:${msg.physicalId}`, msg);
    }

    async handleVerifyHandoffRequest(msg: VerifyHandoffRequestMessage, connection: PeerConnection) {
        if (!this.node.roles.includes(NodeRole.STORAGE)) return;

        try {
            const result = await this.node.storageProvider!.getBlockReadStream(msg.physicalId);
            if (result.status !== 'available' || !result.stream) {
                return connection.send(new VerifyHandoffResponseMessage({
                    marketId: msg.marketId, physicalId: msg.physicalId, targetChunkIndex: msg.targetChunkIndex, chunkDataBase64: '', merkleSiblings: [], success: false
                }));
            }
            
            const CHUNK_SIZE = 64 * 1024; // 64KB Merkle boundaries natively
            const chunks: Buffer[] = [];
            let currentChunk = Buffer.alloc(0);

            result.stream.on('data', (c: Buffer) => {
                currentChunk = Buffer.concat([currentChunk, c]);
                while (currentChunk.length >= CHUNK_SIZE) {
                    chunks.push(currentChunk.subarray(0, CHUNK_SIZE));
                    currentChunk = currentChunk.subarray(CHUNK_SIZE);
                }
            });

            const flushAndResolve = () => {
                if (currentChunk.length > 0) chunks.push(currentChunk);
                currentChunk = Buffer.alloc(0);

                if (chunks.length === 0 || msg.targetChunkIndex >= chunks.length) {
                    return connection.send(new VerifyHandoffResponseMessage({
                        marketId: msg.marketId, physicalId: msg.physicalId, targetChunkIndex: msg.targetChunkIndex, chunkDataBase64: '', merkleSiblings: [], success: false
                    }));
                }

                const { tree } = cryptoUtils.buildMerkleTree(chunks);
                const merkleSiblings = cryptoUtils.getMerkleProof(tree, msg.targetChunkIndex);
                const chunkDataBase64 = chunks[msg.targetChunkIndex].toString('base64');
                
                connection.send(new VerifyHandoffResponseMessage({
                    marketId: msg.marketId, physicalId: msg.physicalId, targetChunkIndex: msg.targetChunkIndex, chunkDataBase64, merkleSiblings, success: true
                }));
            };

            result.stream.on('end', flushAndResolve);

            result.stream.on('error', () => {
                connection.send(new VerifyHandoffResponseMessage({
                    marketId: msg.marketId, physicalId: msg.physicalId, targetChunkIndex: msg.targetChunkIndex, chunkDataBase64: '', merkleSiblings: [], success: false
                }));
            });
        } catch (error: any) {
            logger.error(`[Peer ${this.node.port}] Failed resolving verification handoff physically catching constraints: ${error.message}`);
            connection.send(new VerifyHandoffResponseMessage({
                marketId: msg.marketId, physicalId: msg.physicalId, targetChunkIndex: msg.targetChunkIndex, chunkDataBase64: '', merkleSiblings: [], success: false
            }));
        }
    }

    async handleVerifyHandoffResponse(msg: VerifyHandoffResponseMessage, _unusedConnection: PeerConnection) {
        this.node.events.emit(`handoff_response:${msg.marketId}:${msg.physicalId}`, msg);
    }

    async handleMerkleProofChallengeRequest(msg: MerkleProofChallengeRequestMessage, _unusedConnection: PeerConnection) {
        if (this.node.peer) this.node.peer.broadcast(msg).catch(()=>{});
        if (!this.node.roles.includes(NodeRole.STORAGE)) return;

        try {
            const result = await this.node.storageProvider!.getBlockReadStream(msg.physicalId);
            if (result.status !== 'available' || !result.stream) {
                logger.warn(`[SyncEngine DEBUG] Missed challenge block physically missing! File not found in local disk bounds: ${msg.physicalId}`);
                return;
            }
            
            const CHUNK_SIZE = 64 * 1024;
            const chunks: Buffer[] = [];
            let currentChunk = Buffer.alloc(0);

            result.stream.on('data', (c: Buffer) => {
                currentChunk = Buffer.concat([currentChunk, c]);
                while (currentChunk.length >= CHUNK_SIZE) {
                    chunks.push(currentChunk.subarray(0, CHUNK_SIZE));
                    currentChunk = currentChunk.subarray(CHUNK_SIZE);
                }
            });

            const flushAndResolve = () => {
                if (currentChunk.length > 0) chunks.push(currentChunk);
                currentChunk = Buffer.alloc(0);

                if (chunks.length === 0 || msg.chunkIndex >= chunks.length) {
                    logger.info(`[SyncEngine DEBUG] Missing or Out-Of-Bounds chunk index req: ${msg.chunkIndex} >= ${chunks.length}. Broadcasting false.`);
                    const respMsg = new MerkleProofChallengeResponseMessage({
                        contractId: msg.contractId, physicalId: msg.physicalId, chunkDataBase64: '', merkleSiblings: [], computedRootMatch: false
                    });
                    if (this.node.peer) this.node.peer.broadcast(respMsg).catch(()=>{});
                    return;
                }

                const { tree } = cryptoUtils.buildMerkleTree(chunks);
                const merkleSiblings = cryptoUtils.getMerkleProof(tree, msg.chunkIndex);
                const chunkDataBase64 = chunks[msg.chunkIndex].toString('base64');
                
                logger.info(`[SyncEngine DEBUG] Assembled valid proof for shard chunk ${msg.chunkIndex}. Broadcasting true...`);
                const respMsg = new MerkleProofChallengeResponseMessage({
                    contractId: msg.contractId, physicalId: msg.physicalId, chunkDataBase64, merkleSiblings, computedRootMatch: true
                });
                if (this.node.peer) this.node.peer.broadcast(respMsg).catch(()=>{});
            };

            result.stream.on('end', flushAndResolve);

            result.stream.on('error', () => {
                const respMsg = new MerkleProofChallengeResponseMessage({
                    contractId: msg.contractId, physicalId: msg.physicalId, chunkDataBase64: '', merkleSiblings: [], computedRootMatch: false
                });
                if (this.node.peer) this.node.peer.broadcast(respMsg).catch(()=>{});
            });
        } catch (error: any) {
            logger.error(`[Peer ${this.node.port}] Failed resolving verification handoff physically catching constraints: ${error.message}`);
        }
    }

    async handleMerkleProofChallengeResponse(msg: MerkleProofChallengeResponseMessage, _unusedConnection: PeerConnection) {
        if (this.node.peer) this.node.peer.broadcast(msg).catch(()=>{});
        logger.info(`[Auditor DEBUG] Received response for contractId=${msg.contractId} physicalId=${msg.physicalId} computed=${msg.computedRootMatch} dataLength=${msg.chunkDataBase64?.length}`);
        this.node.events.emit(`merkle_audit_response:${msg.contractId}:${msg.physicalId}`, msg);
    }

    async performInitialSync() {
        if (!this.node.peer) return;
        if (this.node.peer.trustedPeers.length === 0) return;

        this.isSyncing = true;
        this.syncBuffer = [];
        this._chainStatusResponses = [];

        logger.info(`[Peer ${this.node.port}] Initiating Core Ledger Sync mapped across ${this.node.peer.trustedPeers.length} active network hosts...`);
        let localLatest = await this.node.ledger.getLatestBlock();

        this.node.peer.broadcast(new ChainStatusRequestMessage()).catch(err => {
            logger.warn(`[Peer ${this.node.port}] Chain sync broadcast exception ignored: ${err.message}`);
        });

        await new Promise(resolve => setTimeout(resolve, 3000));

        const indexCounts: Record<number, { count: number, peers: PeerConnection[], hash: string }> = {};
        let highestConsensusIndex = -1;
        // let _highestConsensusHash: string | null = null;
        let highestConsensusPeers: PeerConnection[] = [];

        for (const res of this._chainStatusResponses) {
            const k = res.latestIndex;
            if (!indexCounts[k]) indexCounts[k] = { count: 0, peers: [], hash: res.latestHash };
            indexCounts[k].count++;
            indexCounts[k].peers.push(res.connection);
        }

        const responderCount = this._chainStatusResponses.length;
        if (responderCount > 0) {
            for (const key in indexCounts) {
                const data = indexCounts[key];
                const index = parseInt(key, 10);
                if (data.count >= Math.ceil(responderCount / 2)) {
                    if (index > highestConsensusIndex) {
                        highestConsensusIndex = index;
                        // highestConsensusHash = data.hash;
                        highestConsensusPeers = data.peers;
                    }
                }
            }
        }

        const isLocalValid = await this.node.ledger.isChainValid();
        if (!isLocalValid) {
            logger.warn(`[Peer ${this.node.port}] Critical internal hash misalignment detected! Wiping local blockchain entirely resetting zero bounds...`);
            await this.node.ledger.purgeChain();
            localLatest = await this.node.ledger.getLatestBlock();
        }

        if (highestConsensusIndex > localLatest.metadata.index) {
            logger.info(`[Peer ${this.node.port}] Synchronizing missing payload layers: ${localLatest.metadata.index + 1} -> ${highestConsensusIndex}`);

            for (let i = localLatest.metadata.index + 1; i <= highestConsensusIndex; i++) {
                this._blockSyncResponses = new Map();
                const validNetworkNodes = highestConsensusPeers;

                if (validNetworkNodes.length === 0) {
                    logger.error(`[Peer ${this.node.port}] Dropping sync synchronization loop over null majority counts!`);
                    break;
                }

                let primaryHostConnection = validNetworkNodes[i % validNetworkNodes.length];
                primaryHostConnection.send(new BlockSyncRequestMessage({ index: i }));

                let verifyHostConnection: any = null;
                if (validNetworkNodes.length >= 2) {
                    verifyHostConnection = validNetworkNodes[(i + 1) % validNetworkNodes.length];
                    verifyHostConnection.send(new BlockSyncRequestMessage({ index: i }));
                }

                await new Promise(resolve => setTimeout(resolve, 2000));

                const mainBlock = this._blockSyncResponses.get(`${i}_${primaryHostConnection.peerAddress}`);
                const secondaryBlock = verifyHostConnection ? this._blockSyncResponses.get(`${i}_${verifyHostConnection.peerAddress}`) : null;

                if (!mainBlock) {
                    logger.error(`[Peer ${this.node.port}] Sync stalling upon missing block chunk ${i}! Provider node timed tracking loop down!`);
                    break;
                }

                if (verifyHostConnection && secondaryBlock) {
                    if (mainBlock.hash !== secondaryBlock.hash) {
                        logger.error(`[Peer ${this.node.port}] Blockchain Validator Collision! Provider[${primaryHostConnection.peerAddress}] and Validator[${verifyHostConnection.peerAddress}] returned conflicting branches crossing block ${i}. Nullifying routine!`);
                        break;
                    }
                }


                const clonedBlock = { ...mainBlock };
                delete clonedBlock.hash;
                delete clonedBlock._id;

                const structuralPrevious = await this.node.ledger.getLatestBlock();

                if (cryptoUtils.hashData(JSON.stringify(clonedBlock)) !== mainBlock.hash || mainBlock.previousHash !== structuralPrevious.hash) {
                    logger.error(`[Peer ${this.node.port}] Dropping invalid mathematical cryptographic sync index ${i}!`);
                    break;
                }

                await this.node.ledger.addBlockToChain(mainBlock);
                logger.info(`[Peer ${this.node.port}] Mathematical verification successful appending block [${i}] from source ${primaryHostConnection.peerAddress}`);
                
                let mainPubKey = primaryHostConnection.remoteCredentials_?.rsaKeyPair?.public?.toString('utf8');
                if (mainPubKey) {
                    await this.node.reputationManager.rewardValidSync(mainPubKey);
                }
            }
        } else {
            logger.info(`[Peer ${this.node.port}] Mathematical consensus fully synchronized scaling network bounds globally up to speed!`);
        }

        logger.info(`[Peer ${this.node.port}] Completing Active Sync - Processing Buffer Arrays spanning [${this.syncBuffer.length} objects] intercepted`);
        this.isSyncing = false;

        const tempNativeQueue = [...this.syncBuffer];
        this.syncBuffer = [];
        for (const evt of tempNativeQueue) {
            if (evt.type === 'PendingBlock') {
                await this.node.consensusEngine.handlePendingBlock(evt.block!, evt.connection, evt.timestamp!);
            } else if (evt.type === 'AdoptFork') {
                await this.node.consensusEngine.handleAdoptFork(evt.forkId!, evt.finalTipHash!, evt.connection);
            } else if (evt.type === 'ProposeFork') {
                await this.node.consensusEngine.handleProposeFork(evt.forkId!, evt.blockIds!, evt.connection);
            }
        }
    }
}

export default SyncEngine;
