import * as crypto from 'crypto';

import { GENESIS_TIMESTAMP, BLOCK_TYPES, calculateAuditDecayInterval } from '../../constants';
import { hashData, signData, verifySignature, verifyMerkleProof } from '../../crypto_utils/CryptoUtils';
import logger from '../../logger/Logger';
import { AdoptForkMessage } from '../../messages/adopt_fork_message/AdoptForkMessage';
import { MerkleProofChallengeRequestMessage } from '../../messages/merkle_proof_challenge_request_message/MerkleProofChallengeRequestMessage';
import { PendingBlockMessage } from '../../messages/pending_block_message/PendingBlockMessage';
import { ProposeForkMessage } from '../../messages/propose_fork_message/ProposeForkMessage';
import { VerifyBlockMessage } from '../../messages/verify_block_message/VerifyBlockMessage';
import Mempool from '../../models/mempool/Mempool';
import PeerNode from '../../peer_node/PeerNode';
import type { Block, PeerConnection, TransactionPayload, StorageContractPayload, SlashingPayload, CheckpointStatePayload } from '../../types';
import WalletManager from '../../wallet_manager/WalletManager';


/**
 * @typedef {import('../types').PeerConnection} PeerConnection
 * @typedef {import('../types').Block} Block
 */

class ConsensusEngine {
    node: PeerNode;
    mempool: Mempool;
    committing: boolean;
    proposalTimeout: NodeJS.Timeout | null;
    walletManager: WalletManager;
    private auditedIntervals: Map<string, number> = new Map();

    constructor(peerNode: PeerNode) {
        this.node = peerNode;
        this.mempool = peerNode.mempool;
        this.committing = false;
        this.proposalTimeout = null;
        this.walletManager = new WalletManager(peerNode.ledger);
    }

    bindHandlers() {
        this.node.peer?.bind(PendingBlockMessage).to(async (m: PendingBlockMessage, c: PeerConnection) => {
            // @ts-ignore
            await this.handlePendingBlock(m.block, c, m.header?.timestamp.getTime());
        });
        this.node.peer?.bind(VerifyBlockMessage).to(async (m: VerifyBlockMessage, c: PeerConnection) => {
            await this.handleVerifyBlock(m.blockId, m.signature, c);
        });
        this.node.peer?.bind(ProposeForkMessage).to(async (m: ProposeForkMessage, c: PeerConnection) => {
            await this.handleProposeFork(m.forkId, m.blockIds, c);
        });
        this.node.peer?.bind(AdoptForkMessage).to(async (m: AdoptForkMessage, c: PeerConnection) => {
            await this.handleAdoptFork(m.forkId, m.finalTipHash, c);
        });
    }

    async handlePendingBlock(block: Block, connection: PeerConnection, headerTimestamp: number) {
        if (this.node.syncEngine && this.node.syncEngine.isSyncing) {
            this.node.syncEngine.syncBuffer.push({ type: 'PendingBlock', block, connection, timestamp: headerTimestamp });
            return;
        }

        if (!block || !block.publicKey || !block.signature || !block.payload || !block.metadata) {
            logger.info(`[Peer ${this.node.port}] Rejected malformed block from ${connection.peerAddress}`);
            if (block && block.publicKey) {
                await this.node.reputationManager.penalizeMajor(block.publicKey, "Structural Failure");
            }
            return;
        }

        const latestBlock = await this.node.ledger.getLatestBlock();
        if (block.metadata.index !== -1 && latestBlock && block.metadata.index < (latestBlock.metadata.index - 5)) {
            logger.info(`[Peer ${this.node.port}] Rejected Excessively Stale Block from ${connection.peerAddress}`);
            await this.node.reputationManager.penalizeMinor(block.publicKey, "Stale Block or Fork Deviation");
            return;
        }

        const blockToHash = { ...block };
        delete blockToHash.hash;
        // @ts-ignore
        delete blockToHash._id;
        const recalculatedHash = hashData(JSON.stringify(blockToHash));

        if (block.hash && block.hash !== recalculatedHash) {
            logger.info(`[Peer ${this.node.port}] Rejected Hash Mismatch from ${connection.peerAddress}`);
            await this.node.reputationManager.penalizeMajor(block.publicKey, "Hash Mismatch");
            return;
        }

        const blockId = crypto.createHash('sha256').update(block.signature).digest('hex');

        const isSignatureValid = verifySignature(JSON.stringify(block.payload), block.signature, block.publicKey);
        if (!isSignatureValid) {
            logger.info(`[Peer ${this.node.port}] Rejected Invalid Pending Block from ${connection.peerAddress}`);
            await this.node.reputationManager.penalizeCritical(block.publicKey, "Signature Forgery");
            return;
        }

        if (block.type === BLOCK_TYPES.TRANSACTION) {
            const txPayload = block.payload as TransactionPayload;
            const hasFunds = await this.walletManager.verifyFunds(txPayload.senderId, txPayload.amount);
            if (!hasFunds && txPayload.senderId !== 'SYSTEM') {
                logger.warn(`[Peer ${this.node.port}] Rejected Transaction: Insufficient Funds from ${txPayload.senderId}`);
                if (this.node.reputationManager) await this.node.reputationManager.penalizeMajor(block.publicKey, "Insufficient Funds Double Spend");
                return;
            }
        }

        if (block.type === BLOCK_TYPES.SLASHING_TRANSACTION) {
            const slashPayload = block.payload as SlashingPayload;
            if (!slashPayload.evidenceSignature || !slashPayload.penalizedPublicKey || !slashPayload.burntAmount) {
                logger.warn(`[Peer ${this.node.port}] Rejected Slashing: Forgery of evidence signature bounds`);
                if (this.node.reputationManager) await this.node.reputationManager.penalizeCritical(block.publicKey, "Slashing Forgery");
                return;
            }
            if (!this.verifySlashingEvidence(slashPayload, block.publicKey)) {
                logger.warn(`[Peer ${this.node.port}] Rejected Slashing: Invalid evidence signature format/proof`);
                if (this.node.reputationManager) await this.node.reputationManager.penalizeCritical(block.publicKey, "Slashing Forgery");
                return;
            }
        }

        if (block.type === BLOCK_TYPES.CHECKPOINT) {
            const chkPayload = block.payload as CheckpointStatePayload;
            const expectedRoots = await this.walletManager.buildStateRoot();
            
            if (chkPayload.stateMerkleRoot !== expectedRoots.stateMerkleRoot || chkPayload.activeContractsMerkleRoot !== expectedRoots.activeContractsMerkleRoot) {
                logger.warn(`[Peer ${this.node.port}] Rejected CHECKPOINT: State Root mismatch! Forgery detected. Expected SR: ${expectedRoots.stateMerkleRoot.slice(0,8)} vs Got SR: ${chkPayload.stateMerkleRoot.slice(0,8)}`);
                if (this.node.reputationManager) await this.node.reputationManager.penalizeCritical(block.publicKey, "Checkpoint State Forgery");
                return;
            }
            logger.info(`[Peer ${this.node.port}] Verified CHECKPOINT Block successfully matching local physical Merkle roots.`);
        }

        if (this.node.reputationManager) await this.node.reputationManager.rewardHonestProposal(block.publicKey);

        if (!this.mempool.pendingBlocks.has(blockId)) {
            this.mempool.pendingBlocks.set(blockId, {
                block: block,
                verifications: new Set(),
                originalTimestamp: headerTimestamp ? new Date(headerTimestamp).getTime() : Date.now()
            });
            // Successfully verified as novel and valid, relay to external peers!
            if (this.node.peer && connection.peerAddress !== `127.0.0.1:${this.node.port}`) {
                this.node.peer.broadcast(new PendingBlockMessage({ block })).catch(err => {
                    logger.warn(`[Peer ${this.node.port}] Suppressed relayed PendingBlock broadcast exception: ${err.message}`);
                });
            }
        }

        logger.info(`[Peer ${this.node.port}] Verified Pending Block ${blockId.slice(0, 8)} from ${connection.peerAddress}`);

        const privateKey = this.node.privateKey;
        const myVerificationSig = signData(blockId, privateKey);

        this.handleVerifyBlock(blockId, myVerificationSig, { peerAddress: `127.0.0.1:${this.node.port}` } as PeerConnection);

        if (this.mempool.orphanedVerifications.has(blockId)) {
            const orphans = this.mempool.orphanedVerifications.get(blockId);
            this.mempool.orphanedVerifications.delete(blockId);
            for (const orphan of orphans!) {
                this.handleVerifyBlock(blockId, orphan.signature, orphan.connection);
            }
        }

        if (this.node.peer) {
            this.node.peer.broadcast(new VerifyBlockMessage({ blockId, signature: myVerificationSig as string })).catch(err => {
                logger.warn(`[Peer ${this.node.port}] Suppressed VerifyBlock broadcast exception: ${err.message}`);
            });
        }
    }

    async handleVerifyBlock(blockId: string, signature: string, connection: PeerConnection) {
        if (!blockId) {
            logger.warn(`[Peer ${this.node.port}] Discarding malformed VerifyBlockMessage with undefined blockId.`);
            return;
        }
        logger.info(`[Peer ${this.node.port}] handleVerifyBlock invoked: blockId=${blockId.slice(0, 8)}, peer=${connection.peerAddress}`);
        const pendingEntry = this.mempool.pendingBlocks.get(blockId);
        if (!pendingEntry) {
            logger.info(`[Peer ${this.node.port}] Buffering orphaned verification for blockId: ${blockId.slice(0, 8)} from ${connection.peerAddress}`);
            if (!this.mempool.orphanedVerifications.has(blockId)) {
                this.mempool.orphanedVerifications.set(blockId, []);
            }
            this.mempool.orphanedVerifications.get(blockId)!.push({ signature, connection });
            return;
        }

        if (pendingEntry.verifications.has(connection.peerAddress)) return;
        pendingEntry.verifications.add(connection.peerAddress);
        logger.info(`[Peer ${this.node.port}] Verification for ${blockId.slice(0, 8)} from ${connection.peerAddress}. Total: ${pendingEntry.verifications.size}`);

        if (this.node.peer && connection.peerAddress !== `127.0.0.1:${this.node.port}`) {
            this.node.peer.broadcast(new VerifyBlockMessage({ blockId, signature })).catch(err => {
                logger.warn(`[Peer ${this.node.port}] Suppressed VerifyBlock relay exception: ${err.message}`);
            });
        }

        const majority = this.node.getMajorityCount();
        if (pendingEntry.verifications.size >= majority && !pendingEntry.eligible) {
            pendingEntry.eligible = true;
            logger.info(`[Peer ${this.node.port}] Block ${blockId.slice(0, 8)} is ELIGIBLE. Scheduling fork proposal...`);

            if (this.proposalTimeout) clearTimeout(this.proposalTimeout);
            this.proposalTimeout = setTimeout(() => {
                this._checkAndProposeFork().catch(err => logger.warn(`[Peer ${this.node.port}] Fork proposal timer error: ${err.message}`));
                this.proposalTimeout = null;
            }, 500);
        }
    }

    async _checkAndProposeFork() {
        const eligibleBlockIds: string[] = [];
        for (const [bId, pEntry] of this.mempool.pendingBlocks.entries()) {
            if (pEntry.eligible && !pEntry.committed) {
                eligibleBlockIds.push(bId);
            }
        }

        if (eligibleBlockIds.length === 0) return;

        if (eligibleBlockIds.length === 0) return;

        eligibleBlockIds.sort((a, b) => {
            const entryA = this.mempool.pendingBlocks.get(a);
            const entryB = this.mempool.pendingBlocks.get(b);
            const tsA = new Date(entryA!.originalTimestamp).getTime();
            const tsB = new Date(entryB!.originalTimestamp).getTime();
            if (tsA !== tsB) return tsA - tsB;
            return a < b ? -1 : 1;
        });

        const forkId = crypto.createHash('sha256').update(eligibleBlockIds.join(',')).digest('hex');

        const forkEntry = this.mempool.eligibleForks.get(forkId);
        if (!forkEntry || !forkEntry.adopted) {
            logger.info(`[Peer ${this.node.port}] Proposing Fork ${forkId.slice(0, 8)} with ${eligibleBlockIds.length} blocks`);
            this.handleProposeFork(forkId, eligibleBlockIds, { peerAddress: `127.0.0.1:${this.node.port}` } as PeerConnection);
            if (this.node.peer) {
                this.node.peer.broadcast(new ProposeForkMessage({ forkId, blockIds: eligibleBlockIds })).catch(err => {
                    logger.warn(`[Peer ${this.node.port}] Suppressed ProposeFork broadcast exception: ${err.message}`);
                });
            }
        }
    }

    async handleProposeFork(forkId: string, blockIds: string[], connection: PeerConnection) {
        logger.info(`[Peer ${this.node.port}] handleProposeFork invoked: forkId=${forkId ? forkId.slice(0, 8) : 'undefined'}, peer=${connection.peerAddress}`);
        if (!this.mempool.eligibleForks.has(forkId)) {
            this.mempool.eligibleForks.set(forkId, { blockIds, proposals: new Set() });
        }

        const forkEntry = this.mempool.eligibleForks.get(forkId);
        if (forkEntry!.proposals.has(connection.peerAddress)) return;
        
        forkEntry!.proposals.add(connection.peerAddress);
        logger.info(`[Peer ${this.node.port}] Proposal for Fork ${forkId.slice(0, 8)} from ${connection.peerAddress}. Total: ${forkEntry!.proposals.size}`);

        if (this.node.peer && connection.peerAddress !== `127.0.0.1:${this.node.port}`) {
            this.node.peer.broadcast(new ProposeForkMessage({ forkId, blockIds })).catch(e => {
                logger.warn(`[Peer ${this.node.port}] Suppressed ProposeFork relay exception: ${e.message}`);
            });
        }

        const majority = this.node.getMajorityCount();
        if (forkEntry!.proposals.size >= majority && !forkEntry!.adopted) {
            forkEntry!.adopted = true;
            logger.info(`[Peer ${this.node.port}] Fork ${forkId.slice(0, 8)} is CONFIRMED. Computing final blocks...`);

            const latestBlock = await this.node.ledger.getLatestBlock();
            let previousHash = latestBlock ? latestBlock.hash : '0'.repeat(64);
            let index = latestBlock && latestBlock.metadata ? latestBlock.metadata.index : -1;
            let finalTipHash = '';

            forkEntry!.computedBlocks = [];
            for (const bId of blockIds) {
                const pEntry = this.mempool.pendingBlocks.get(bId);
                if (!pEntry) continue;

                index++;
                const newBlock: Block = {
                    metadata: { index, timestamp: pEntry.originalTimestamp || Date.now() },
                    type: pEntry.block.type || BLOCK_TYPES.STORAGE_CONTRACT,
                    previousHash,
                    publicKey: pEntry.block.publicKey,
                    payload: pEntry.block.payload,
                    signature: pEntry.block.signature
                } as Block;

                const blockToHash = { ...newBlock };
                const strToHash = JSON.stringify(blockToHash);
                newBlock.hash = crypto.createHash('sha256').update(strToHash).digest('hex');
                previousHash = newBlock.hash!;
                finalTipHash = newBlock.hash!;

                forkEntry!.computedBlocks.push(newBlock);
            }

            this.handleAdoptFork(forkId, finalTipHash, { peerAddress: `127.0.0.1:${this.node.port}` } as PeerConnection);

            const msg = new AdoptForkMessage({ forkId, finalTipHash });
            if (this.node.peer && this.node.peer.trustedPeers.length > 0) {
                this.node.peer.broadcast(msg).catch(err => {
                    logger.warn(`[Peer ${this.node.port}] Suppressed consensus adoption broadcast exception: ${err.message}`);
                });
            }

            const settledEntry = this.mempool.settledForks.get(forkId);
            if (settledEntry && settledEntry.pendingCommit && !settledEntry.committed) {
                await this._commitFork(forkId);
            }
        }
    }

    async handleAdoptFork(forkId: string, finalTipHash: string, connection: PeerConnection) {
        if (this.node.syncEngine && this.node.syncEngine.isSyncing) {
            this.node.syncEngine.syncBuffer.push({ type: 'AdoptFork', forkId, finalTipHash, connection });
            return;
        }

        logger.info(`[Peer ${this.node.port}] handleAdoptFork invoked: forkId=${forkId ? forkId.slice(0, 8) : 'undefined'}, peer=${connection.peerAddress}`);
        if (!this.mempool.settledForks.has(forkId)) {
            this.mempool.settledForks.set(forkId, { finalTipHash, adoptions: new Set() });
        }

        const settledEntry = this.mempool.settledForks.get(forkId);
        if (settledEntry!.finalTipHash !== finalTipHash) return;
        if (settledEntry!.adoptions.has(connection.peerAddress)) return;

        settledEntry!.adoptions.add(connection.peerAddress);
        logger.info(`[Peer ${this.node.port}] Adoption for Fork ${forkId.slice(0, 8)} from ${connection.peerAddress}. Total: ${settledEntry!.adoptions.size}`);

        if (this.node.peer && connection.peerAddress !== `127.0.0.1:${this.node.port}`) {
            this.node.peer.broadcast(new AdoptForkMessage({ forkId, finalTipHash })).catch(e => {
                logger.warn(`[Peer ${this.node.port}] Suppressed consensus adoption relay exception: ${e.message}`);
            });
        }

        const majority = this.node.getMajorityCount();
        if (settledEntry!.adoptions.size >= majority && !settledEntry!.committed) {
            const forkEntry = this.mempool.eligibleForks.get(forkId);
            if (forkEntry && forkEntry.computedBlocks) {
                await this._commitFork(forkId);
            } else {
                settledEntry!.pendingCommit = true;
                logger.info(`[Peer ${this.node.port}] Fork ${forkId.slice(0, 8)} has majority adoptions, but blocks not yet computed locally. Waiting...`);
            }
        }
    }

    async _commitFork(forkId: string) {
        if (this.committing) {
            logger.info(`[Peer ${this.node.port}] Already committing another fork. Deferring...`);
            setTimeout(() => this._commitFork(forkId), 500);
            return;
        }

        const settledEntry = this.mempool.settledForks.get(forkId);
        const forkEntry = this.mempool.eligibleForks.get(forkId);
        if (!settledEntry || !forkEntry || !forkEntry.computedBlocks) return;

        this.committing = true;
        try {
            const latestBlock = await this.node.ledger.getLatestBlock();
            const lastHash = latestBlock ? latestBlock.hash : '0'.repeat(64);

            if (forkEntry.computedBlocks[0].previousHash !== lastHash) {
                logger.info(`[Peer ${this.node.port}] Fork ${forkId.slice(0, 8)} is stale (tip mismatch). Discarding commit.`);
                forkEntry.adopted = false;
                this.committing = false;
                return;
            }

            settledEntry.committed = true;
            logger.info(`[Peer ${this.node.port}] Fork ${forkId.slice(0, 8)} is SETTLED. Committing to database...`);
            for (const block of forkEntry.computedBlocks) {
                const existing = await this.node.ledger.collection!.findOne({ signature: block.signature });
                if (existing) {
                    logger.info(`[Peer ${this.node.port}] Block with signature ${block.signature.slice(-16)} already in chain. Skipping.`);

                    const sigHash = crypto.createHash('sha256').update(block.signature).digest('hex');
                    const pEntry = this.mempool.pendingBlocks.get(sigHash);
                    if (pEntry) pEntry.committed = true;

                    continue;
                }

                delete block._id;

                await this.node.ledger.addBlockToChain(block);
                logger.info(`[Peer ${this.node.port}] Committed block index ${block.metadata.index} (hash: ${block.hash!.slice(0, 8)})`);

                if (block.type === BLOCK_TYPES.CHECKPOINT) {
                    await this.node.ledger.pruneHistory(block.metadata.index);
                    logger.info(`[Peer ${this.node.port}] Successfully pruned historical ledger up to boundary limit ${block.metadata.index} based on structural CHECKPOINT validation.`);
                } else {
                    const EPOCH_SIZE = 1000000;
                    if (block.metadata.index > 0 && block.metadata.index % EPOCH_SIZE === 0) {
                        if (block.publicKey === this.node.publicKey) {
                            logger.info(`[Peer ${this.node.port}] Node triggered Epoch Boundary at index ${block.metadata.index}! Formulating Checkpoint block...`);

                            const stateRoots = await this.walletManager.buildStateRoot();
                            const checkpointPayload: CheckpointStatePayload = {
                                epochIndex: Math.floor(block.metadata.index / EPOCH_SIZE),
                                startHash: ''.padStart(64, '0'),
                                endHash: block.hash!,
                                stateMerkleRoot: stateRoots.stateMerkleRoot,
                                activeContractsMerkleRoot: stateRoots.activeContractsMerkleRoot
                            };
                            
                            const sigStr = signData(JSON.stringify(checkpointPayload), this.node.privateKey);
                            const checkpointBlock: Block = {
                                metadata: { index: block.metadata.index + 1, timestamp: Date.now() },
                                type: BLOCK_TYPES.CHECKPOINT,
                                payload: checkpointPayload,
                                publicKey: this.node.publicKey,
                                previousHash: block.hash!,
                                signature: sigStr as string
                            };
                            
                            await this.handlePendingBlock(checkpointBlock, { peerAddress: '0.0.0.0', send: () => {} } as any, Date.now());
                        }
                    }
                }

                const sigHash = crypto.createHash('sha256').update(block.signature).digest('hex');
                for (const [bId, pEntry] of this.mempool.pendingBlocks.entries()) {
                    if (bId === sigHash) {
                        pEntry.committed = true;
                        break;
                    }
                }

                this.node.events.emit(`settled:${sigHash}`, block);
            }

            await this._checkAndProposeFork();
            
            this.runGlobalAudit().catch(err => logger.warn(`[Peer ${this.node.port}] Global audit loop trace failed natively: ${err.message}`));
        } catch (error) {
            logger.error(`[Peer ${this.node.port}] Error committing fork ${forkId.slice(0, 8)}:`, error);
        } finally {
            this.committing = false;
        }
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
        // Enforce that evidenceSignature is a valid cryptographically generated SHA256 hash or signature block.
        // It must not be an arbitrary textual string (prevents griefing).
        const hexRegex = /^[0-9a-fA-F]{64}$/;
        if (!hexRegex.test(payload.evidenceSignature)) {
            return false;
        }
        return true;
    }

    computeDeterministicAuditor(contractId: string, latestBlockHash: string, intervalBucket: number): boolean {
        const challengeString = `${contractId}-${latestBlockHash}-${intervalBucket}`;
        const challengeHashHex = crypto.createHash('sha256').update(challengeString).digest('hex');
        
        let closestId = this.node.publicKey;
        const selfHashHex = crypto.createHash('sha256').update(this.node.publicKey).digest('hex');
        let minDistance = this.computeXORDistance(challengeHashHex, selfHashHex);

        if (this.node.peer && this.node.peer.peers) {
            for (const p of this.node.peer.peers) {
                const pubKey = p.remoteCredentials_?.rsaKeyPair?.public?.toString('utf8');
                if (pubKey) {
                    const peerHashHex = crypto.createHash('sha256').update(pubKey).digest('hex');
                    const distance = this.computeXORDistance(challengeHashHex, peerHashHex);
                    if (this.isSmallerDistance(distance, minDistance)) {
                        minDistance = distance;
                        closestId = pubKey;
                    }
                }
            }
        }

        return closestId === this.node.publicKey;
    }

    async runGlobalAudit() {
        if (this.node.syncEngine && this.node.syncEngine.isSyncing) return;
        
        const latestBlock = await this.node.ledger.getLatestBlock();
        const latestBlockHash = latestBlock ? latestBlock.hash! : 'genesis_hash';
        
        const genesisBlock = await this.node.ledger.getBlockByIndex(0);
        const genesisTimestamp = genesisBlock?.metadata?.timestamp || Date.now();
        const intervalBucketMs = calculateAuditDecayInterval(genesisTimestamp);
        const intervalBucket = Math.floor(Date.now() / intervalBucketMs);

        const contracts = await this.node.ledger.collection!.find({ type: BLOCK_TYPES.STORAGE_CONTRACT }).sort({ 'metadata.timestamp': -1 }).limit(10).toArray();
        if (!contracts.length) return;

        let hasAudited = false;

        for (const contract of contracts) {
            const trackKey = `${contract._id!.toString()}-${intervalBucket}`;
            if (this.auditedIntervals.has(trackKey)) continue;

            const isElected = this.computeDeterministicAuditor(contract._id!.toString(), latestBlockHash, intervalBucket);
            if (!isElected) continue;

            this.auditedIntervals.set(trackKey, intervalBucket);
            
            if (!hasAudited) {
                logger.info(`[Peer ${this.node.port}] Node deterministically elected as Auditor. Initiating mathematical Proof of Spacetime intervals...`);
                this.node.events.emit('audit_telemetry', { status: 'ELECTION_INITIATED', message: 'Node deterministically elected as Auditor. Initiating mathematical Proof of Spacetime intervals...' });
                hasAudited = true;
            }

            const contractPayload = contract.payload as StorageContractPayload;
            if (!contractPayload.fragmentMap || !contractPayload.merkleRoots) continue;

            for (const fragment of contractPayload.fragmentMap) {
                if (fragment.nodeId === this.node.publicKey) continue; // Skip auditing self logically
                
                const merkleRoot = contractPayload.merkleRoots[fragment.shardIndex];
                
                const CHUNK_SIZE = 64 * 1024;
                const K = contractPayload.erasureParams!.k;
                const paddedSize = Math.ceil(contractPayload.erasureParams!.originalSize / K) * K;
                const shardSize = paddedSize / K;
                const totalChunks = Math.ceil(shardSize / CHUNK_SIZE);
                
                const challengeHashHex = crypto.createHash('sha256').update(`${contract._id!.toString()}-${latestBlockHash}-${intervalBucket}`).digest('hex');
                const numericHash = parseInt(challengeHashHex.slice(0, 8), 16);
                const targetIndex = totalChunks > 0 ? numericHash % totalChunks : 0;

                const challengeMsg = new MerkleProofChallengeRequestMessage({
                    contractId: contract._id!.toString(), 
                    physicalId: fragment.physicalId,
                    auditorPublicKey: this.node.publicKey,
                    chunkIndex: targetIndex
                });
                
                this.node.events.emit('audit_telemetry', { status: 'CHALLENGE_DISPATCHED', message: `Dispatching Merkle challenge targeting Shard ${fragment.shardIndex} at Chunk Index ${targetIndex}...`, targetPeer: fragment.nodeId });
                
                if (this.node.peer) {
                    try {
                        await this.node.peer.broadcast(challengeMsg);
                    } catch (err: any) {
                        logger.warn(`[Peer ${this.node.port}] Failed to broadcast Merkle challenge: ${err.message}`);
                    }
                }

                const executeSlashing = async (nodeId: string, reason: string) => {
                    const slashPayload = {
                        penalizedPublicKey: nodeId,
                        evidenceSignature: crypto.createHash('sha256').update(JSON.stringify(challengeMsg) + reason).digest('hex'),
                        burntAmount: 50000
                    };
                    try {
                        const signatureStr = signData(JSON.stringify(slashPayload), this.node.privateKey) as string;
                        const pendingBlock: Block = {
                            metadata: { index: -1, timestamp: Date.now() },
                            type: BLOCK_TYPES.SLASHING_TRANSACTION,
                            payload: slashPayload,
                            publicKey: this.node.publicKey,
                            signature: signatureStr
                        };
                        await this.handlePendingBlock(pendingBlock, { peerAddress: `127.0.0.1:${this.node.port}` } as any, Date.now());
                        if (this.node.peer) {
                            const p2pMsg = new PendingBlockMessage({ block: pendingBlock });
                            try {
                                await this.node.peer.broadcast(p2pMsg);
                            } catch (err: any) {
                                logger.warn(`[Peer ${this.node.port}] Broadcast error for slashing block: ${err.message}`);
                            }
                        }
                    } catch (e: any) {
                        logger.warn(`[Peer ${this.node.port}] Failed to execute slashing block: ${e.message}`);
                    }
                };

                const auditId = contract._id!.toString();
                const timeout = setTimeout(async () => {
                    this.node.events.removeAllListeners(`merkle_audit_response:${auditId}`);
                    if (this.node.reputationManager) await this.node.reputationManager.penalizeMajor(fragment.nodeId, "Audit Timeout Offense");
                    logger.warn(`[Peer ${this.node.port}] Host ${fragment.nodeId.slice(0, 8)} failed to return Merkle proof resolving logical blocks! Penalty mapped.`);
                    this.node.events.emit('audit_telemetry', { status: 'SLASHING_EXECUTED', message: `Host ${fragment.nodeId.slice(0, 8)} failed to return Merkle proof. Executing Slashing...`, targetPeer: fragment.nodeId });
                    await executeSlashing(fragment.nodeId, "TIMEOUT");
                }, 5000);

                this.node.events.once(`merkle_audit_response:${auditId}`, async (resMsg: any) => {
                    clearTimeout(timeout);
                    
                    let isValid = false;
                    if (resMsg.computedRootMatch && resMsg.chunkDataBase64 && resMsg.merkleSiblings) {
                        try {
                            const buffer = Buffer.from(resMsg.chunkDataBase64, 'base64');
                            isValid = verifyMerkleProof(buffer, resMsg.merkleSiblings, merkleRoot, targetIndex);
                        } catch (_unusedE) { isValid = false; }
                    }
                    
                    if (!isValid) {
                        if (this.node.reputationManager) await this.node.reputationManager.penalizeCritical(fragment.nodeId, "Proof of Spacetime Forgery");
                        logger.warn(`[Peer ${this.node.port}] Host ${fragment.nodeId.slice(0, 8)} explicitly failed mathematical audit! Banned!`);
                        this.node.events.emit('audit_telemetry', { status: 'SLASHING_EXECUTED', message: `Host ${fragment.nodeId.slice(0, 8)} explicitly failed mathematical audit! Banned!`, targetPeer: fragment.nodeId });
                        await executeSlashing(fragment.nodeId, "FORGERY_INVALID_BOUNDS");
                    } else {
                        if (this.node.reputationManager) await this.node.reputationManager.rewardHonestProposal(fragment.nodeId);
                        logger.info(`[Peer ${this.node.port}] Host ${fragment.nodeId.slice(0, 8)} perfectly mapped rigorous spacetime boundaries!`);
                        this.node.events.emit('audit_telemetry', { status: 'AUDIT_SUCCESS', message: `Host ${fragment.nodeId.slice(0, 8)} perfectly mapped rigorous spacetime boundaries!`, targetPeer: fragment.nodeId });
                        
                        // Phase 5 Financial Execution 
                        const reward = WalletManager.calculateSystemReward(Date.now(), GENESIS_TIMESTAMP);
                        const hostReward = reward * 0.9;
                        const auditorReward = reward * 0.1;
                        
                        try {
                            const [hostTx, auditorTx] = await Promise.all([
                                this.walletManager.allocateFunds('SYSTEM', fragment.nodeId, hostReward, 'SYSTEM_SIG'),
                                this.walletManager.allocateFunds('SYSTEM', this.node.publicKey, auditorReward, 'SYSTEM_SIG')
                            ]);
                            
                            const mintTxBlock = async (txPayload: any) => {
                                if (!txPayload) return;
                                const sig = signData(JSON.stringify(txPayload), this.node.privateKey) as string;
                                const b: Block = {
                                    metadata: { index: -1, timestamp: Date.now() },
                                    type: BLOCK_TYPES.TRANSACTION,
                                    payload: txPayload,
                                    publicKey: this.node.publicKey,
                                    signature: sig
                                };
                                await this.handlePendingBlock(b, { peerAddress: `127.0.0.1:${this.node.port}` } as any, Date.now());
                                if (this.node.peer) {
                                    const p2pMsg = new PendingBlockMessage({ block: b });
                                    try {
                                        await this.node.peer.broadcast(p2pMsg);
                                    } catch (err: any) {
                                        logger.warn(`[Peer ${this.node.port}] Broadcast error for audit reward block: ${err.message}`);
                                    }
                                }
                            };

                            await mintTxBlock(hostTx);
                            await mintTxBlock(auditorTx);
                        } catch (e: any) {
                            logger.error(`Failed to formulate compensation bounds: ${e.message}`);
                        }
                    }
                });

                if (this.node.peer) {
                    await this.node.peer.broadcast(challengeMsg).catch(e => {
                        logger.warn(`[Peer ${this.node.port}] Audit broadcast routing latency drop: ${e.message}`);
                    });
                }
            }
        }
    }
}

export default ConsensusEngine;
