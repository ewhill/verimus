import PeerNode from '../../peer_node/PeerNode';
import logger from '../../logger/Logger';
import { ChainStatusRequestMessage } from '../../messages/chain_status_request_message/ChainStatusRequestMessage';
import { ChainStatusResponseMessage } from '../../messages/chain_status_response_message/ChainStatusResponseMessage';
import { BlockSyncRequestMessage } from '../../messages/block_sync_request_message/BlockSyncRequestMessage';
import { BlockSyncResponseMessage } from '../../messages/block_sync_response_message/BlockSyncResponseMessage';
import { StorageRequestMessage } from '../../messages/storage_request_message/StorageRequestMessage';
import { StorageBidMessage } from '../../messages/storage_bid_message/StorageBidMessage';
import { NetworkHealthSyncMessage } from '../../messages/network_health_sync_message/NetworkHealthSyncMessage';
import type { Block, PeerConnection } from '../../types';
import { NodeRole } from '../../types/NodeRole';

export interface SyncBufferEvent {
    type: 'PendingBlock' | 'AdoptFork';
    block?: Block;
    connection: PeerConnection;
    timestamp?: number;
    forkId?: string;
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
        this.node.peer?.bind(ChainStatusRequestMessage).to(async (m: ChainStatusRequestMessage, c: PeerConnection) => this.handleChainStatusRequest(c));
        this.node.peer?.bind(ChainStatusResponseMessage).to(async (m: ChainStatusResponseMessage, c: PeerConnection) => this.handleChainStatusResponse(m.latestIndex, m.latestHash, c));
        this.node.peer?.bind(BlockSyncRequestMessage).to(async (m: BlockSyncRequestMessage, c: PeerConnection) => this.handleBlockSyncRequest(m.index, c));
        this.node.peer?.bind(BlockSyncResponseMessage).to(async (m: BlockSyncResponseMessage, c: PeerConnection) => this.handleBlockSyncResponse(m.block, c));
        this.node.peer?.bind(NetworkHealthSyncMessage).to(async (m: NetworkHealthSyncMessage, c: PeerConnection) => this.handleNetworkHealthSync(m.score_payloads, c));
        this.node.peer?.bind(StorageRequestMessage).to(async (m: StorageRequestMessage, c: PeerConnection) => this.handleStorageRequest(m, c));
        this.node.peer?.bind(StorageBidMessage).to(async (m: StorageBidMessage, c: PeerConnection) => this.handleStorageBid(m, c));

        // Start native background polling effectively
        if (this.node.peer) {
            this.syncInterval = setInterval(async () => {
                if (!this.node.ledger.peersCollection) return;
                const peers = await this.node.ledger.peersCollection.find({}).toArray();
                const score_payloads = peers.map(p => ({ publicKey: p.publicKey, score: p.score, roles: p.roles }));
                
                // Also broadcast our own native node roles mapped organically
                score_payloads.push({ publicKey: this.node.publicKey, score: 100, roles: this.node.roles });
                if (score_payloads.length > 0) {
                    this.node.peer!.broadcast(new NetworkHealthSyncMessage({ score_payloads })).catch(() => {});
                }
            }, 60000);
        }
    }

    async handleNetworkHealthSync(score_payloads: { publicKey: string, score: number, roles?: NodeRole[] }[], connection: PeerConnection) {
        if (!this.node.ledger.peersCollection) return;
        
        for (const remoteScore of score_payloads) {
            const localPeer = await this.node.ledger.peersCollection.findOne({ publicKey: remoteScore.publicKey });
            if (localPeer) {
                // Drift Fix: Preserve internal cutoff bounds if local score is drastically lower (Sybil defense)
                if (localPeer.isBanned || localPeer.score === 0) continue; // Banned locally, permanently isolated
                if (localPeer.score < remoteScore.score && (remoteScore.score - localPeer.score) > 20) {
                    continue; // Discard whitewashing attempts securely preserving underlying local bounds natively
                }

                // Assert aggregation smoothly ignoring 0 swings 
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
                // Safely ingest new metrics explicitly tracking natively cleanly
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
        // Broadcast the limit order globally across the swarm natively
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

        // Await N valid bids filling the order book instantly, or timeout gracefully
        return new Promise((resolve) => {
            const market = this.activeStorageMarkets.get(requestId)!;
            market.resolve = resolve;
            
            setTimeout(() => {
                const finalMarket = this.activeStorageMarkets.get(requestId);
                if (finalMarket) {
                    finalMarket.resolve(finalMarket.bids);
                    this.activeStorageMarkets.delete(requestId);
                }
            }, 10000); // 10 second maximum timeout boundary natively
        });
    }

    async handleStorageRequest(msg: StorageRequestMessage, connection: PeerConnection) {
        // Only valid if this node operates the STORAGE role explicitly natively
        if (!this.node.roles.includes(NodeRole.STORAGE)) return;

        // Ensure we are not bidding on our own packets mapping isolated networks gracefully
        if (msg.senderId === this.node.publicKey) return;

        // Check if we can beat the maxCost limit organically
        const egressCost = this.node.storageProvider?.getEgressCostPerGB ? this.node.storageProvider.getEgressCostPerGB() : 0.00;
        if (egressCost > msg.maxCostPerGB) return; // Drop request naturally

        // Formulate returning Bid payload successfully 
        const bidMsg = new StorageBidMessage({
            storageRequestId: msg.storageRequestId,
            storageHostId: this.node.publicKey,
            proposedCostPerGB: egressCost,
            guaranteedUptimeMs: 86400000 // Mock 24h guarantee for now mappings dynamically
        });

        connection.send(bidMsg);
    }

    async handleStorageBid(msg: StorageBidMessage, connection: PeerConnection) {
        const market = this.activeStorageMarkets.get(msg.storageRequestId);
        if (!market) return; // Invalid or expired order

        // If cost exceeds our strict ceiling limit order mappings drop it
        if (msg.proposedCostPerGB > market.maxCostPerGB) return;

        // Record the limit order bid natively safely
        market.bids.push({
            peerId: msg.storageHostId,
            cost: msg.proposedCostPerGB,
            uptime: msg.guaranteedUptimeMs,
            connection
        });

        // Triage Cutoff logic! If array hits 'N' required limit boundaries exactly natively stop the timer early!
        if (market.bids.length >= market.requiredNodes) {
             market.resolve(market.bids);
             this.activeStorageMarkets.delete(msg.storageRequestId);
        }
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
        let highestConsensusHash: string | null = null;
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
                        highestConsensusHash = data.hash;
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
                    logger.error(`[Peer ${this.node.port}] Dropping sync synchronization loop natively over null majority counts!`);
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

                const { hashData } = require('../../crypto_utils/CryptoUtils');
                const clonedBlock = { ...mainBlock };
                delete clonedBlock.hash;
                delete clonedBlock._id;

                const structuralPrevious = await this.node.ledger.getLatestBlock();

                if (hashData(JSON.stringify(clonedBlock)) !== mainBlock.hash || mainBlock.previousHash !== structuralPrevious.hash) {
                    logger.error(`[Peer ${this.node.port}] Dropping structurally invalid mathematical cryptographic sync index ${i}!`);
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

        logger.info(`[Peer ${this.node.port}] Completing Active Sync - Processing Buffer Arrays dynamically spanning [${this.syncBuffer.length} objects] intercepted natively`);
        this.isSyncing = false;

        const tempNativeQueue = [...this.syncBuffer];
        this.syncBuffer = [];
        for (const evt of tempNativeQueue) {
            if (evt.type === 'PendingBlock') {
                await this.node.consensusEngine.handlePendingBlock(evt.block!, evt.connection, evt.timestamp!);
            } else if (evt.type === 'AdoptFork') {
                await this.node.consensusEngine.handleAdoptFork(evt.forkId!, evt.finalTipHash!, evt.connection);
            }
        }
    }
}

export default SyncEngine;
