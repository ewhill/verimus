import * as crypto from 'crypto';
import { monitorEventLoopDelay } from 'node:perf_hooks';

import { ethers } from 'ethers';

import { GENESIS_TIMESTAMP, BLOCK_TYPES, calculateAuditDecayInterval } from '../../constants';
import { verifyMerkleProof } from '../../crypto_utils/CryptoUtils';
import { EIP712_DOMAIN, EIP712_SCHEMAS, normalizeBlockForSignature, hydrateBlockBigInts } from '../../crypto_utils/EIP712Types';
import logger from '../../logger/Logger';
import { MerkleProofChallengeRequestMessage } from '../../messages/merkle_proof_challenge_request_message/MerkleProofChallengeRequestMessage';
import PeerNode from '../../peer_node/PeerNode';
import type { Block, StorageContractPayload, SlashingPayload } from '../../types';
import { SyncState } from '../../types/SyncState';
import KeyedMutex from '../../utils/KeyedMutex';
import WalletManager from '../../wallet_manager/WalletManager';

class GlobalAuditor {
    private node: PeerNode;
    private auditedIntervals: Map<string, number> = new Map();
    private auditTimer: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;
    private pendingChallenges: Set<NodeJS.Timeout> = new Set();
    
    // Scoped instance lock ensuring intervals never overlap concurrently natively mapped via Keys
    private mutex = new KeyedMutex();
    private eventLoopMonitor = monitorEventLoopDelay({ resolution: 20 });

    constructor(peerNode: PeerNode) {
        this.node = peerNode;
    }

    get walletManager() { return this.node.walletManager; }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.eventLoopMonitor.enable();

        const auditTask = async () => {
            const release = await this.mutex.acquire('global_audit');
            try {
                await this.runGlobalAudit();
            } catch (err: any) {
                logger.warn(`[Peer ${this.node.port}] Global audit loop trace failed natively: ${err.message}`);
            } finally {
                release();
            }
        };

        // Trigger rapid initial audit capturing bootstrapping genesis limits natively preventing starvation mappings
        setTimeout(auditTask, 15000);

        this.auditTimer = setInterval(auditTask, 30000);
        this.auditTimer.unref();
    }

    stop() {
        if (this.auditTimer) {
            clearInterval(this.auditTimer);
            this.auditTimer = null;
        }
        for (const t of this.pendingChallenges) {
            clearTimeout(t);
        }
        this.pendingChallenges.clear();
        this.isRunning = false;
        this.eventLoopMonitor.disable();
    }

    private computeXORDistance(hashA: string, hashB: string): string {
        let result = '';
        for (let i = 0; i < hashA.length; i++) {
            const hexA = parseInt(hashA[i], 16);
            const hexB = parseInt(hashB[i], 16);
            result += (hexA ^ hexB).toString(16);
        }
        return result;
    }

    private isSmallerDistance(hexA: string, hexB: string): boolean {
        if (hexA.length !== hexB.length) return hexA.length < hexB.length;
        for (let i = 0; i < hexA.length; i++) {
            const a = parseInt(hexA[i], 16);
            const b = parseInt(hexB[i], 16);
            if (a !== b) return a < b;
        }
        return false;
    }

    verifySlashingEvidence(payload: SlashingPayload, _unusedAuditorPublicKey: string): boolean {
        const hexRegex = /^[0-9a-fA-F]{64}$/;
        if (!hexRegex.test(payload.evidenceSignature)) {
            return false;
        }
        return true;
    }

    computeDeterministicAuditor(contractId: string, latestBlockHash: string, intervalBucket: number): boolean {
        const challengeString = `${contractId}-${latestBlockHash}-${intervalBucket}`;
        const challengeHashHex = crypto.createHash('sha256').update(challengeString).digest('hex');

        const sanitizeKey = (k: string) => k.replace(/\s+/g, '');
        const cleanSelfId = this.node.publicKey ? sanitizeKey(this.node.publicKey) : '';
        let closestId = cleanSelfId;
        const selfHashHex = crypto.createHash('sha256').update(cleanSelfId).digest('hex');
        let minDistance = this.computeXORDistance(challengeHashHex, selfHashHex);

        if (this.node.peer && this.node.peer.peers) {
            for (const p of this.node.peer.peers) {
                const pubKeyRaw = p.remoteCredentials_?.walletAddress || p.remoteCredentials_?.rsaKeyPair?.public?.toString('utf8');
                if (pubKeyRaw) {
                    const cleanPeerId = sanitizeKey(pubKeyRaw);
                    const peerHashHex = crypto.createHash('sha256').update(cleanPeerId).digest('hex');
                    const distance = this.computeXORDistance(challengeHashHex, peerHashHex);
                    if (this.isSmallerDistance(distance, minDistance)) {
                        minDistance = distance;
                        closestId = cleanPeerId;
                    }
                }
            }
        }

        return closestId === cleanSelfId;
    }

    async runGlobalAudit() {
        // Suspend audits natively preventing starvation mappings while bootstrapping
        if (this.node.syncEngine && this.node.syncEngine.currentState !== SyncState.ACTIVE) return;

        const latestBlock = await this.node.ledger.getLatestBlock();
        const latestBlockHash = latestBlock && latestBlock.hash ? latestBlock.hash : 'genesis_hash';

        const genesisBlock = await this.node.ledger.getBlockByIndex(0);
        const genesisTimestamp = genesisBlock?.metadata?.timestamp || Date.now();
        const timeSinceGenesis = Math.max(0, Date.now() - genesisTimestamp);

        const discretizedNow = Math.floor(Date.now() / (15 * 60 * 1000)) * (15 * 60 * 1000);
        const intervalBucketMs = calculateAuditDecayInterval(genesisTimestamp, discretizedNow);
        const intervalBucket = Math.floor(timeSinceGenesis / intervalBucketMs);

        const contracts = await this.node.ledger.collection!.find({ type: BLOCK_TYPES.STORAGE_CONTRACT }).sort({ 'metadata.timestamp': -1 }).limit(10).toArray();
        if (!contracts.length) return;

        let hasAudited = false;

        for (const contract of contracts) {
            hydrateBlockBigInts(contract as Block);
            const payload = contract.payload as any;
            if (payload?.expirationBlockHeight !== undefined) {
                if (BigInt(payload.expirationBlockHeight) <= BigInt(latestBlock?.metadata?.index || 0)) {
                    continue; // Skip auditing expired contracts protecting honest hosts
                }
            }

            if (!contract.hash) continue;
            const contractHash = contract.hash;
            const trackKey = `${contractHash}-${intervalBucket}`;
            if (this.auditedIntervals.has(trackKey)) continue;

            this.auditedIntervals.set(trackKey, intervalBucket);

            const isElected = this.computeDeterministicAuditor(contractHash, latestBlockHash, intervalBucket);
            if (!isElected) continue;

            if (!hasAudited) {
                logger.info(`[Peer ${this.node.port}] Node deterministically elected as Auditor. Initiating mathematical Proof of Spacetime intervals...`);
                this.node.events.emit('audit_telemetry', { status: 'ELECTION_INITIATED', message: 'Node deterministically elected as Auditor. Initiating mathematical Proof of Spacetime intervals...' });
                hasAudited = true;
            }

            const contractPayload = contract.payload as StorageContractPayload;
            if (!contractPayload.fragmentMap || !contractPayload.merkleRoots) continue;

            for (const fragment of contractPayload.fragmentMap) {
                if (fragment.nodeId === this.node.walletAddress) continue;

                const merkleRoot = contractPayload.merkleRoots[Number(fragment.shardIndex)];

                const CHUNK_SIZE = 64 * 1024;
                const K = Number(contractPayload.erasureParams!.k);
                const originalSizeNum = Number(contractPayload.erasureParams!.originalSize);
                const paddedSize = Math.ceil(originalSizeNum / K) * K;
                const shardSize = paddedSize / K;
                const totalChunks = Math.ceil(shardSize / CHUNK_SIZE);

                const challengeHashHex = crypto.createHash('sha256').update(`${contractHash}-${latestBlockHash}-${intervalBucket}`).digest('hex');
                const numericHash = parseInt(challengeHashHex.slice(0, 8), 16);
                const targetIndex = totalChunks > 0 ? numericHash % totalChunks : 0;

                this.node.events.emit('audit_telemetry', { status: 'CHALLENGE_DISPATCHED', message: `Dispatching Merkle challenge targeting Shard ${fragment.shardIndex} at Chunk Index ${targetIndex}...`, targetPeer: fragment.nodeId });

                const executeSlashing = async (nodeId: string, reason: string) => {
                    logger.warn(`[Peer ${this.node.port}] Executing slashing for ${nodeId} due to: ${reason}`);
                    const slashPayload = {
                        penalizedAddress: nodeId,
                        evidenceSignature: crypto.createHash('sha256').update(`${contractHash}:${fragment.physicalId}:${targetIndex}:${reason}`).digest('hex'),
                        burntAmount: ethers.parseUnits("50000", 18)
                    };
                    try {
                        const pendingBlock: Block = {
                            metadata: { index: -1, timestamp: Date.now() },
                            type: BLOCK_TYPES.SLASHING_TRANSACTION,
                            payload: slashPayload,
                            signerAddress: this.node.walletAddress,
                            signature: ''
                        };
                        const valueObj = normalizeBlockForSignature(pendingBlock);
                        const schema = EIP712_SCHEMAS[BLOCK_TYPES.SLASHING_TRANSACTION];
                        pendingBlock.signature = await this.node.wallet.signTypedData(EIP712_DOMAIN, schema, valueObj.payload ? valueObj : valueObj);
                        
                        // Decoupled notification rather than direct execution
                        this.node.events.emit('AUDITOR:SLASHING_GENERATED', pendingBlock);
                        
                        if (this.node.peer) {
                            // Optionally broadcast pre-verified structural block
                        }
                    } catch (e: any) {
                        logger.warn(`[Peer ${this.node.port}] Failed to execute slashing block formulation: ${e.message}`);
                    }
                };

                const auditId = contractHash;
                const MAX_RETRIES = 3;
                const BASE_TIMEOUT_MS = 5000;
                let currentAttempt = 0;
                let currentTimeoutRef: NodeJS.Timeout;
                let isResolved = false;

                const attemptChallenge = () => {
                    const challengeMsg = new MerkleProofChallengeRequestMessage({
                        contractId: contractHash,
                        physicalId: fragment.physicalId,
                        auditorPublicKey: this.node.publicKey,
                        auditorNodeId: this.node.walletAddress,
                        targetNodeId: fragment.nodeId,
                        chunkIndex: targetIndex
                    });

                    if (this.node.peer) {
                        this.node.peer.broadcast(challengeMsg).catch(e => {
                            logger.warn(`[Peer ${this.node.port}] Audit broadcast routing latency drop: ${e.message}`);
                        });
                    }

                    const backoffTimeout = BASE_TIMEOUT_MS * Math.pow(2, currentAttempt);

                    currentTimeoutRef = setTimeout(async () => {
                        this.pendingChallenges.delete(currentTimeoutRef);
                        
                        if (currentAttempt < MAX_RETRIES) {
                            currentAttempt++;
                            logger.info(`[Peer ${this.node.port}] P2P Timeout resolving Merkle sequence. Exponential backoff retry ${currentAttempt}/${MAX_RETRIES} for host ${fragment.nodeId}...`);
                            attemptChallenge();
                        } else {
                            if (isResolved) return;
                            
                            const meanDelay = this.eventLoopMonitor.mean / 1e6; // Convert ns to ms
                            if (meanDelay > 100) {
                                logger.warn(`[Peer ${this.node.port}] Node load threshold exceeded (${meanDelay.toFixed(2)}ms). Dynamically suppressing auditor slashing timeout falsely mapped to P2P lag!`);
                                // Extend retries and try again gracefully preventing false positive slashes mathematically
                                currentAttempt--; 
                                attemptChallenge();
                                return;
                            }

                            isResolved = true;
                            this.node.events.off(`merkle_audit_response:${auditId}:${fragment.physicalId}`, responseHandler);
                            if (fragment.nodeId !== 'GENESIS_NODE') {
                                if (this.node.reputationManager) await this.node.reputationManager.penalizeMajor(fragment.nodeId, "Audit Timeout Offense");
                                logger.warn(`[Peer ${this.node.port}] Host ${fragment.nodeId} failed to return Merkle proof for physicalId=${fragment.physicalId} auditId=${auditId}! Penalty mapped.`);
                                this.node.events.emit('audit_telemetry', { status: 'SLASHING_EXECUTED', message: `Host ${fragment.nodeId} failed to return Merkle proof. Executing Slashing...`, targetPeer: fragment.nodeId });
                                await executeSlashing(fragment.nodeId, "TIMEOUT");
                            } else {
                                logger.warn(`[Peer ${this.node.port}] GENESIS audit broadcast timed out. No honest hosts responded within the matrix limit.`);
                                this.node.events.emit('audit_telemetry', { status: 'AUDIT_TIMEOUT', message: `GENESIS audit broadcast dropped. Waiting for reliable host response in future bucket bounds...`, targetPeer: fragment.nodeId });
                            }
                        }
                    }, backoffTimeout);
                    this.pendingChallenges.add(currentTimeoutRef);
                };

                const responseHandler = async (resMsg: any) => {
                    if (isResolved) return;
                    if (resMsg.auditorNodeId && resMsg.auditorNodeId !== this.node.walletAddress) return;

                    isResolved = true;
                    clearTimeout(currentTimeoutRef);
                    this.node.events.off(`merkle_audit_response:${auditId}:${fragment.physicalId}`, responseHandler);

                    let isValid = false;
                    if (resMsg.computedRootMatch && resMsg.chunkDataBase64 && resMsg.merkleSiblings) {
                        try {
                            const buffer = Buffer.from(resMsg.chunkDataBase64, 'base64');
                            isValid = verifyMerkleProof(buffer, resMsg.merkleSiblings, merkleRoot, targetIndex);
                        } catch (_unusedE) { isValid = false; }
                    }

                    if (!isValid) {
                        const targetSlashNode = resMsg.responderNodeId || fragment.nodeId;
                        if (targetSlashNode !== 'GENESIS_NODE') {
                            if (this.node.reputationManager) await this.node.reputationManager.penalizeCritical(targetSlashNode, "Proof of Spacetime Forgery");
                            logger.warn(`[Peer ${this.node.port}] Host ${targetSlashNode} explicitly failed mathematical audit! Banned!`);
                            this.node.events.emit('audit_telemetry', { status: 'SLASHING_EXECUTED', message: `Host ${targetSlashNode} explicitly failed mathematical audit! Banned!`, targetPeer: targetSlashNode });
                            await executeSlashing(targetSlashNode, "FORGERY_INVALID_BOUNDS");
                        }
                    } else {
                        const targetRewardNode = resMsg.responderNodeId || fragment.nodeId;
                        if (targetRewardNode === 'GENESIS_NODE') return; // Absolute mathematical edge guard preventing ghost allocation arrays strictly
                        if (this.node.reputationManager) await this.node.reputationManager.rewardHonestProposal(targetRewardNode);
                        logger.info(`[Peer ${this.node.port}] Host ${targetRewardNode} perfectly mapped rigorous spacetime boundaries!`);
                        this.node.events.emit('audit_telemetry', { status: 'AUDIT_SUCCESS', message: `Host ${targetRewardNode} perfectly mapped rigorous spacetime boundaries!`, targetPeer: targetRewardNode });

                        const reward = WalletManager.calculateSystemReward(Date.now(), GENESIS_TIMESTAMP);
                        const hostReward = (reward * 90n) / 100n;
                        const auditorReward = reward - hostReward;

                        try {
                            const [hostTx, auditorTx] = await Promise.all([
                                this.walletManager.allocateFunds(ethers.ZeroAddress, targetRewardNode, hostReward, 'SYSTEM_SIG'),
                                this.walletManager.allocateFunds(ethers.ZeroAddress, this.node.walletAddress, auditorReward, 'SYSTEM_SIG')
                            ]);

                            const mintTxBlock = async (txPayload: any) => {
                                if (!txPayload) return;

                                const b: Block = {
                                    metadata: { index: -1, timestamp: Date.now() },
                                    type: BLOCK_TYPES.TRANSACTION,
                                    payload: txPayload,
                                    signerAddress: this.node.walletAddress,
                                    signature: ''
                                };
                                const valueObj = normalizeBlockForSignature(b);
                                const schema = EIP712_SCHEMAS[BLOCK_TYPES.TRANSACTION];
                                b.signature = await this.node.wallet.signTypedData(EIP712_DOMAIN, schema, valueObj.payload ? valueObj : valueObj);
                                
                                // Route to component bus natively
                                this.node.events.emit('AUDITOR:REWARD_GENERATED', b);
                            };

                            await mintTxBlock(hostTx);
                            await mintTxBlock(auditorTx);
                        } catch (e: any) {
                            logger.error(`Failed to formulate compensation bounds: ${e.message}`);
                        }
                    }
                };

                this.node.events.on(`merkle_audit_response:${auditId}:${fragment.physicalId}`, responseHandler);
                attemptChallenge();
            }
        }
    }
}

export default GlobalAuditor;
