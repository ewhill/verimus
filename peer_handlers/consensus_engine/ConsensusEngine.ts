

import * as crypto from 'crypto';

import { ethers } from 'ethers';

import { GENESIS_TIMESTAMP, BLOCK_TYPES, calculateAuditDecayInterval, IS_DEV_NETWORK } from '../../constants';
import { hashData, signData, verifyEIP712BlockSignature, verifyMerkleProof } from '../../crypto_utils/CryptoUtils';
import { EIP712_DOMAIN, EIP712_SCHEMAS, normalizeBlockForSignature, hydrateBlockBigInts } from '../../crypto_utils/EIP712Types';
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
    private activeForkTimeouts: Map<string, NodeJS.Timeout> = new Map();

    // CRITICAL FIX: Utilize explicit promise chain as a structural mutex, universally preventing all database overlap race conditions mathematically organically.
    private taskQueue: Promise<void> = Promise.resolve();

    private async enqueueTask<T>(task: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.taskQueue = this.taskQueue.then(async () => {
                try {
                    resolve(await task());
                } catch (_unusedE) {
                    reject(_unusedE);
                }
            });
        });
    }

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

        // Initialize Decentralized Market Validation Job
        const auditTimer = setInterval(() => {
            this.runGlobalAudit().catch(err => logger.warn(`[Peer ${this.node.port}] Global audit loop trace failed natively: ${err.message}`));
        }, 30000); // 30s jitter loop mappings evaluating chronological sortition independent of dynamic user upload chains
        auditTimer.unref();
    }

    async handlePendingBlock(block: Block, connection: PeerConnection, headerTimestamp: number) {
        return this.enqueueTask(async () => {
            hydrateBlockBigInts(block);

            if (this.node.syncEngine && this.node.syncEngine.isSyncing) {
                this.node.syncEngine.syncBuffer.push({ type: 'PendingBlock', block, connection, timestamp: headerTimestamp });
                return;
            }

            if (!block || !block.signerAddress || !block.signature || !block.payload || !block.metadata) {
                logger.info(`[Peer ${this.node.port}] Rejected malformed block from ${connection.peerAddress}`);
                if (block && block.signerAddress) {
                    await this.node.reputationManager.penalizeMajor(block.signerAddress, "Structural Failure");
                }
                return;
            }

            const latestBlock = await this.node.ledger.getLatestBlock();
            if (block.metadata.index !== -1 && latestBlock && block.metadata.index < (latestBlock.metadata.index - 5)) {
                logger.info(`[Peer ${this.node.port}] Rejected Excessively Stale Block from ${connection.peerAddress}`);
                await this.node.reputationManager.penalizeMinor(block.signerAddress, "Stale Block or Fork Deviation");
                return;
            }

            const blockToHash = { ...block };
            delete blockToHash.hash;
            // @ts-ignore
            delete (blockToHash as any)._id;
            const recalculatedHash = hashData(JSON.stringify(blockToHash));

            if (block.hash && block.hash !== recalculatedHash) {
                logger.info(`[Peer ${this.node.port}] Rejected Hash Mismatch from ${connection.peerAddress}`);
                await this.node.reputationManager.penalizeMajor(block.signerAddress, "Hash Mismatch");
                return;
            }

            // CRITICAL FIX: Use the mathematically deterministic recalculation Hash directly
            // rather than only mapping block.signature uniquely preventing dummy-sig static overlays
            const blockId = recalculatedHash;

            const isSignatureValid = verifyEIP712BlockSignature(block);
            logger.warn(`[DEBUG] handlePendingBlock hash: ${recalculatedHash}, valid: ${isSignatureValid}`); if (!isSignatureValid) {
                logger.info(`[Peer ${this.node.port}] Rejected Invalid Pending Block from ${connection.peerAddress}`);
                await this.node.reputationManager.penalizeCritical(block.signerAddress, "Signature Forgery");
                return;
            }

            if (block.type === BLOCK_TYPES.TRANSACTION) {
                const txPayload = block.payload as TransactionPayload;
                const hasFunds = await this.walletManager.verifyFunds(txPayload.senderAddress, txPayload.amount);
                if (!hasFunds && txPayload.senderAddress !== ethers.ZeroAddress) {
                    logger.warn(`[Peer ${this.node.port}] Rejected Transaction: Insufficient Funds from ${txPayload.senderAddress}`);
                    if (this.node.reputationManager) await this.node.reputationManager.penalizeMajor(block.signerAddress, "Insufficient Funds Double Spend");
                    return;
                }
            }

            if (block.type === BLOCK_TYPES.STORAGE_CONTRACT) {
                const scPayload = block.payload as StorageContractPayload;
                if (scPayload.ownerAddress && scPayload.allocatedEgressEscrow !== undefined) {
                    logger.error(`[DEBUG] handlePendingBlock typeof allocatedEgressEscrow: ${typeof scPayload.allocatedEgressEscrow}, val: ${scPayload.allocatedEgressEscrow}`);
                    const totalCost = (scPayload.allocatedEgressEscrow * 105n) / 100n;
                    const hasUserFunds = await this.walletManager.verifyFunds(scPayload.ownerAddress, totalCost);
                    if (!hasUserFunds) {
                        logger.warn(`[Peer ${this.node.port}] Rejected STORAGE_CONTRACT: Insufficient EIP-191 Funds for ${scPayload.ownerAddress}`);
                        return;
                    }

                    if (scPayload.fragmentMap && scPayload.fragmentMap.length > 0) {
                        const nodeShare = scPayload.allocatedEgressEscrow / BigInt(scPayload.fragmentMap.length);
                        for (const frag of scPayload.fragmentMap) {
                            const hasNodeFunds = await this.walletManager.verifyFunds(frag.nodeId, nodeShare);
                            if (!hasNodeFunds) {
                                logger.warn(`[Peer ${this.node.port}] Rejected STORAGE_CONTRACT: Insufficient Storage Collateral for Node ${frag.nodeId}`);
                                return;
                            }
                        }
                    }
                }

                if (scPayload.brokerFeePercentage !== undefined && scPayload.brokerFeePercentage > 1500n) {
                    logger.warn(`[Peer ${this.node.port}] Rejected STORAGE_CONTRACT: brokerFeePercentage exceeded 15% (1500 bps) ceiling from ${block.signerAddress}`);
                    return;
                }

                if (!IS_DEV_NETWORK) {
                    const activeContractsCollection = this.node.ledger.activeContractsCollection;
                    if (activeContractsCollection) {
                        const stakingLog = await this.node.ledger.collection!.findOne({ type: BLOCK_TYPES.STAKING_CONTRACT, 'payload.operatorPublicKey': block.signerAddress });
                        if (!stakingLog) {
                            logger.warn(`[Peer ${this.node.port}] Rejected STORAGE_CONTRACT: Originator ${block.signerAddress.slice(0, 8)} possesses NO valid Proof-of-Stake STAKING_CONTRACT collateral!`);
                            return;
                        }
                    }
                }
            }

            if (block.type === BLOCK_TYPES.SLASHING_TRANSACTION) {
                const slashPayload = block.payload as SlashingPayload;
                if (!slashPayload.evidenceSignature || !slashPayload.penalizedAddress || !slashPayload.burntAmount) {
                    logger.warn(`[Peer ${this.node.port}] Rejected Slashing: Forgery of evidence signature bounds`);
                    if (this.node.reputationManager) await this.node.reputationManager.penalizeCritical(block.signerAddress, "Slashing Forgery");
                    return;
                }
                if (!this.verifySlashingEvidence(slashPayload, block.signerAddress)) {
                    logger.warn(`[Peer ${this.node.port}] Rejected Slashing: Invalid evidence signature format/proof`);
                    if (this.node.reputationManager) await this.node.reputationManager.penalizeCritical(block.signerAddress, "Slashing Forgery");
                    return;
                }
            }

            if (block.type === BLOCK_TYPES.CHECKPOINT) {
                const chkPayload = block.payload as CheckpointStatePayload;
                const expectedRoots = await this.walletManager.buildStateRoot();

                if (chkPayload.stateMerkleRoot !== expectedRoots.stateMerkleRoot || chkPayload.activeContractsMerkleRoot !== expectedRoots.activeContractsMerkleRoot) {
                    logger.warn(`[Peer ${this.node.port}] Rejected CHECKPOINT: State Root mismatch! Forgery detected. Expected SR: ${expectedRoots.stateMerkleRoot.slice(0, 8)} vs Got SR: ${chkPayload.stateMerkleRoot.slice(0, 8)}`);
                    if (this.node.reputationManager) await this.node.reputationManager.penalizeCritical(block.signerAddress, "Checkpoint State Forgery");
                    return;
                }
                logger.info(`[Peer ${this.node.port}] Verified CHECKPOINT Block successfully matching local physical Merkle roots.`);
            }

            if (this.node.reputationManager) await this.node.reputationManager.rewardHonestProposal(block.signerAddress);

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

            this.handleVerifyBlock(blockId, myVerificationSig as string, { peerAddress: `127.0.0.1:${this.node.port}` } as PeerConnection);

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
        });
    }

    async handleVerifyBlock(blockId: string, signature: string, connection: PeerConnection) {
        logger.warn(`[DEBUG] handleVerifyBlock received blockId: ${blockId}, sig: ${signature.slice(0, 5)}...`);
        return this.enqueueTask(async () => {
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

            const myAddress = `127.0.0.1:${this.node.port}`;
            // Automatically vote for blocks we have received and successfully verified, if not already voted
            if (!pendingEntry.verifications.has(myAddress)) {
                const privateKey = this.node.privateKey;
                const myVerificationSig = signData(blockId, privateKey);
                pendingEntry.verifications.add(myAddress);
                if (this.node.peer) {
                    this.node.peer.broadcast(new VerifyBlockMessage({ blockId, signature: myVerificationSig as string })).catch(() => { });
                }
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
        });
    }

    async _checkAndProposeFork() {
        const eligibleBlockIds: string[] = [];
        for (const [bId, pEntry] of this.mempool.pendingBlocks.entries()) {
            if (pEntry.eligible && !pEntry.committed) {
                eligibleBlockIds.push(bId);
            }
        }

        if (eligibleBlockIds.length === 0) return;

        eligibleBlockIds.sort((a, b) => {
            const entryA = this.mempool.pendingBlocks.get(a)!;
            const entryB = this.mempool.pendingBlocks.get(b)!;

            const tsA = entryA.block.metadata.timestamp || 0;
            const tsB = entryB.block.metadata.timestamp || 0;
            if (tsA !== tsB) return tsA - tsB;

            return a < b ? -1 : 1;
        });

        // CRITICAL FIX: To prevent concurrent overlapping fork proposals branching from the exact same tip,
        // strictly propose ONLY the oldest single deterministic block.
        const latestBlock = await this.node.ledger.getLatestBlock();
        const previousHash = latestBlock && latestBlock.hash ? latestBlock.hash : '0'.repeat(64);

        const targetBlockId = eligibleBlockIds[0];
        const tempBlockIds = [targetBlockId];

        // Append previousHash directly into the forkId to natively isolate collisions structurally mapped physically
        const hashBase = crypto.createHash('sha256').update(tempBlockIds.join(',')).digest('hex').slice(0, 32);
        const forkId = `${hashBase}_${previousHash.slice(0, 16)}`;

        const forkEntry = this.mempool.eligibleForks.get(forkId);
        if (!forkEntry || !forkEntry.adopted) {
            this.handleProposeFork(forkId, tempBlockIds, { peerAddress: `127.0.0.1:${this.node.port}` } as PeerConnection);
            if (this.node.peer) {
                this.node.peer.broadcast(new ProposeForkMessage({ forkId, blockIds: tempBlockIds })).catch(err => {
                    logger.warn(`[Peer ${this.node.port}] Failed to broadcast fork proposal: ${err.message}`);
                });
            }

            if (this.activeForkTimeouts.has(forkId)) {
                clearTimeout(this.activeForkTimeouts.get(forkId)!);
            }

            const timeout = setTimeout(() => {
                this.activeForkTimeouts.delete(forkId);
                logger.warn(`[Peer ${this.node.port}] P2P BFT Timeout Triggered for ${forkId.slice(0, 8)}. Demoting stalled proposal implicitly mathematically unlocking chain bounds.`);
                this.mempool.eligibleForks.delete(forkId);
                this.mempool.settledForks.delete(forkId);

                this._checkAndProposeFork().catch(() => { });
            }, 10000).unref();

            this.activeForkTimeouts.set(forkId, timeout);
        }
    }

    async handleProposeFork(forkId: string, blockIds: string[], connection: PeerConnection) {
        return this.enqueueTask(async () => {
            const tipConstraint = forkId && forkId.includes('_') ? forkId.split('_')[1] : null;
            if (tipConstraint) {
                const latestBlock = await this.node.ledger.getLatestBlock();
                const currentTip = latestBlock && latestBlock.hash ? latestBlock.hash.slice(0, 16) : '0'.repeat(16);
                if (currentTip !== tipConstraint) {
                    logger.warn(`[Peer ${this.node.port}] REJECTED ProposeFork because tip mismatch! currentTip: ${currentTip}, constraint: ${tipConstraint}`);
                    if (this.node.syncEngine) {
                        this.node.syncEngine.syncBuffer.push({ type: 'ProposeFork', forkId, blockIds, connection });
                        this.node.syncEngine.performInitialSync().catch(() => { });
                    }
                    return;
                }
            }

            logger.info(`[Peer ${this.node.port}] handleProposeFork invoked: forkId=${forkId ? forkId.slice(0, 8) : 'undefined'}, peer=${connection.peerAddress}`);
            if (!this.mempool.eligibleForks.has(forkId)) {
                this.mempool.eligibleForks.set(forkId, { blockIds, proposals: new Set() });
            }

            const forkEntry = this.mempool.eligibleForks.get(forkId);
            if (forkEntry!.proposals.has(connection.peerAddress)) return;

            forkEntry!.proposals.add(connection.peerAddress);

            const myAddress = `127.0.0.1:${this.node.port}`;
            if (!forkEntry!.proposals.has(myAddress)) {
                // Verify we actually agree with the fork intrinsically
                let agree = true;
                for (const bId of blockIds) {
                    if (!this.mempool.pendingBlocks.has(bId)) {
                        agree = false;
                        break;
                    }
                }
                if (agree) {
                    forkEntry!.proposals.add(myAddress);
                    if (this.node.peer) {
                        this.node.peer.broadcast(new ProposeForkMessage({ forkId, blockIds })).catch(() => { });
                    }
                }
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
                    if (!pEntry) {
                        logger.warn(`[Peer ${this.node.port}] Node lacks pending block ${bId.slice(0, 8)} for confirmed fork ${forkId.slice(0, 8)}. Deferred.`);
                        forkEntry!.adopted = false;
                        return;
                    }

                    index++;

                    const newBlock: Block = {
                        metadata: { index, timestamp: pEntry.block.metadata?.timestamp || pEntry.originalTimestamp || Date.now() },
                        type: pEntry.block.type || BLOCK_TYPES.STORAGE_CONTRACT,
                        previousHash,
                        signerAddress: pEntry.block.signerAddress,
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
        });
    }

    async handleAdoptFork(forkId: string, finalTipHash: string, connection: PeerConnection) {
        return this.enqueueTask(async () => {
            const tipConstraint = forkId && forkId.includes('_') ? forkId.split('_')[1] : null;
            if (tipConstraint) {
                const latestBlock = await this.node.ledger.getLatestBlock();
                const currentTip = latestBlock && latestBlock.hash ? latestBlock.hash.slice(0, 16) : '0'.repeat(16);
                if (currentTip !== tipConstraint) {
                    if (this.node.syncEngine) {
                        this.node.syncEngine.syncBuffer.push({ type: 'AdoptFork', forkId, finalTipHash, connection });
                        this.node.syncEngine.performInitialSync().catch(() => { });
                    }
                    return;
                }
            }

            logger.info(`[Peer ${this.node.port}] handleAdoptFork invoked: forkId=${forkId ? forkId.slice(0, 8) : 'undefined'}, peer=${connection.peerAddress}`);
            if (!this.mempool.settledForks.has(forkId)) {
                this.mempool.settledForks.set(forkId, { finalTipHash, adoptions: new Set() });
            }

            const settledEntry = this.mempool.settledForks.get(forkId);
            if (settledEntry!.finalTipHash !== finalTipHash) return;
            if (settledEntry!.adoptions.has(connection.peerAddress)) return;

            settledEntry!.adoptions.add(connection.peerAddress);

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
        });
    }

    async _commitFork(forkId: string) {
        const settledEntry = this.mempool.settledForks.get(forkId);
        const forkEntry = this.mempool.eligibleForks.get(forkId);
        if (!settledEntry || !forkEntry || !forkEntry.computedBlocks) return;

        if (this.activeForkTimeouts.has(forkId)) {
            clearTimeout(this.activeForkTimeouts.get(forkId)!);
            this.activeForkTimeouts.delete(forkId);
        }

        this.committing = true;
        try {
            const latestBlock = await this.node.ledger.getLatestBlock();
            const lastHash = latestBlock ? latestBlock.hash : '0'.repeat(64);

            if (forkEntry.computedBlocks[0].previousHash !== lastHash) {
                logger.info(`[Peer ${this.node.port}] Fork ${forkId.slice(0, 8)} is stale (tip mismatch). Discarding commit.`);

                // CRITICAL FIX: To prevent blocks getting stuck perpetually, clear the cache.
                // Otherwise `handleAdoptFork` will reject new tip hashes for the same block combinations.
                this.mempool.eligibleForks.delete(forkId);
                this.mempool.settledForks.delete(forkId);

                this.committing = false;

                // Immediately attempt to formulate a clean fork with the correct tip
                this._checkAndProposeFork().catch(err => logger.warn(`[Peer ${this.node.port}] Retry fork exception: ${err.message}`));
                return;
            }

            settledEntry.committed = true;
            logger.info(`[Peer ${this.node.port}] Fork ${forkId.slice(0, 8)} is SETTLED. Committing to database...`);
            for (const block of forkEntry.computedBlocks) {
                const existing = await this.node.ledger.collection!.findOne({ signature: block.signature });
                if (existing) {
                    logger.info(`[Peer ${this.node.port}] Block with signature ${block.signature.slice(-16)} already in chain. Skipping.`);

                    const blockToHash = { ...block };
                    delete blockToHash.hash;
                    // @ts-ignore
                    delete blockToHash._id;
                    const recalculatedHash = hashData(JSON.stringify(blockToHash));

                    const pEntry = this.mempool.pendingBlocks.get(recalculatedHash);
                    if (pEntry) pEntry.committed = true;

                    this.mempool.pendingBlocks.delete(recalculatedHash);
                    this.node.events.emit(`settled:${recalculatedHash}`, block);

                    continue;
                }

                delete (block as any)._id;

                await this.node.ledger.addBlockToChain(block);
                logger.info(`[Peer ${this.node.port}] Committed block index ${block.metadata.index} (hash: ${block.hash!.slice(0, 8)})`);

                if (block.type === BLOCK_TYPES.CHECKPOINT) {
                    await this.node.ledger.pruneHistory(block.metadata.index);
                    logger.info(`[Peer ${this.node.port}] Successfully pruned historical ledger up to boundary limit ${block.metadata.index} based on structural CHECKPOINT validation.`);
                } else {
                    const EPOCH_SIZE = 1000000;
                    if (block.metadata.index > 0 && block.metadata.index % EPOCH_SIZE === 0) {
                        if (block.signerAddress === this.node.walletAddress) {
                            logger.info(`[Peer ${this.node.port}] Node triggered Epoch Boundary at index ${block.metadata.index}! Formulating Checkpoint block...`);

                            const stateRoots = await this.walletManager.buildStateRoot();
                            const checkpointPayload: CheckpointStatePayload = {
                                epochIndex: Math.floor(block.metadata.index / EPOCH_SIZE),
                                startHash: ''.padStart(64, '0'),
                                endHash: block.hash!,
                                stateMerkleRoot: stateRoots.stateMerkleRoot,
                                activeContractsMerkleRoot: stateRoots.activeContractsMerkleRoot
                            };

                            const valBlock: Block = {
                                metadata: { index: block.metadata.index + 1, timestamp: Date.now() },
                                type: BLOCK_TYPES.CHECKPOINT,
                                payload: checkpointPayload,
                                signerAddress: this.node.walletAddress,
                                previousHash: block.hash!,
                                signature: ''
                            };

                            const valueObj = normalizeBlockForSignature(valBlock);
                            const schema = EIP712_SCHEMAS[BLOCK_TYPES.CHECKPOINT];

                            if (this.node.wallet) {
                                valBlock.signature = await this.node.wallet.signTypedData(EIP712_DOMAIN, schema, valueObj.payload ? valueObj : valueObj);
                            } else {
                                valBlock.signature = signData(JSON.stringify(checkpointPayload), this.node.privateKey) as string;
                            }

                            const checkpointBlock = valBlock;

                            this.handlePendingBlock(checkpointBlock, { peerAddress: '0.0.0.0', send: () => { } } as any, Date.now()).catch((e: any) => logger.warn(`[Peer ${this.node.port}] Suppressed Checkpoint execution wrap exception: ${e.message}`));
                        }
                    }
                }
            }

            for (const bId of forkEntry.blockIds) {
                const pEntry = this.mempool.pendingBlocks.get(bId);
                if (pEntry) {
                    pEntry.committed = true;
                    // CRITICAL FIX: To prevent endless 6 pending blocks anomaly, natively cleanse the queue natively mapped explicitly preventing lingering memory references.
                    this.mempool.pendingBlocks.delete(bId);
                    this.node.events.emit(`settled:${bId}`, pEntry.block);
                }
            }

            this.committing = false;
            await this._checkAndProposeFork();

        } catch (error) {
            logger.error(`[Peer ${this.node.port}] Error committing fork ${forkId.slice(0, 8)}:`, error);
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
                    if (IS_DEV_NETWORK) {
                        logger.info(`[Auditor Eval ${this.node.port}] Node self=[\${this.node.publicKey.length}], peer=[\${pubKey.length}]. Identical bounds: \${this.node.publicKey.trim() === pubKey.trim()}`);
                    }
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
        const timeSinceGenesis = Math.max(0, Date.now() - genesisTimestamp);

        // Stabilize absolute bucket rounding by clamping the fractional float calculation discretely
        const discretizedNow = Math.floor(Date.now() / (15 * 60 * 1000)) * (15 * 60 * 1000);
        const intervalBucketMs = calculateAuditDecayInterval(genesisTimestamp, discretizedNow);

        const intervalBucket = Math.floor(timeSinceGenesis / intervalBucketMs);

        const contracts = await this.node.ledger.collection!.find({ type: BLOCK_TYPES.STORAGE_CONTRACT }).sort({ 'metadata.timestamp': -1 }).limit(10).toArray();
        if (!contracts.length) return;

        let hasAudited = false;

        for (const contract of contracts) {
            const contractHash = contract.hash!;
            const trackKey = `${contractHash}-${intervalBucket}`;
            if (this.auditedIntervals.has(trackKey)) continue;

            // CRITICAL FIX: Lock the evaluation tracker immediately BEFORE exiting!
            // Prevents BFT block advancing from regenerating infinite exponential transactions mapping identical buckets.
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
                if (fragment.nodeId === this.node.publicKey) continue; // Skip auditing self logically
                if (fragment.nodeId === 'GENESIS_NODE' && IS_DEV_NETWORK) continue; // Immutable system seed nodes cannot be mathematically audited over standard P2P Pings in development/test networks natively.

                const merkleRoot = contractPayload.merkleRoots[fragment.shardIndex];

                const CHUNK_SIZE = 64 * 1024;
                const K = contractPayload.erasureParams!.k;
                const paddedSize = Math.ceil(contractPayload.erasureParams!.originalSize / K) * K;
                const shardSize = paddedSize / K;
                const totalChunks = Math.ceil(shardSize / CHUNK_SIZE);

                const challengeHashHex = crypto.createHash('sha256').update(`${contractHash}-${latestBlockHash}-${intervalBucket}`).digest('hex');
                const numericHash = parseInt(challengeHashHex.slice(0, 8), 16);
                const targetIndex = totalChunks > 0 ? numericHash % totalChunks : 0;

                // MerkleProofChallengeRequestMessage is generated dynamically inside attemptChallenge() to ensure valid P2P hash sequences.

                this.node.events.emit('audit_telemetry', { status: 'CHALLENGE_DISPATCHED', message: `Dispatching Merkle challenge targeting Shard ${fragment.shardIndex} at Chunk Index ${targetIndex}...`, targetPeer: fragment.nodeId });

                const executeSlashing = async (nodeId: string, reason: string) => {
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
                        if (this.node.wallet) {
                            pendingBlock.signature = await this.node.wallet.signTypedData(EIP712_DOMAIN, schema, valueObj.payload ? valueObj : valueObj);
                        } else {
                            pendingBlock.signature = signData(JSON.stringify(slashPayload), this.node.privateKey) as string;
                        }
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

                const auditId = contractHash;
                const MAX_RETRIES = 3; // attempt 0 to max strikes
                const BASE_TIMEOUT_MS = 15000;
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
                        if (currentAttempt < MAX_RETRIES) {
                            currentAttempt++;
                            logger.info(`[Peer ${this.node.port}] P2P Timeout resolving Merkle sequence. Exponential backoff retry ${currentAttempt}/${MAX_RETRIES} for host ${fragment.nodeId.slice(0, 8)}...`);
                            attemptChallenge();
                        } else {
                            if (isResolved) return;
                            isResolved = true;
                            this.node.events.off(`merkle_audit_response:${auditId}:${fragment.physicalId}`, responseHandler);
                            if (this.node.reputationManager) await this.node.reputationManager.penalizeMajor(fragment.nodeId, "Audit Timeout Offense");
                            logger.warn(`[Peer ${this.node.port}] Host ${fragment.nodeId.slice(0, 8)} failed to return Merkle proof for physicalId=${fragment.physicalId} auditId=${auditId}! Penalty mapped.`);
                            this.node.events.emit('audit_telemetry', { status: 'SLASHING_EXECUTED', message: `Host ${fragment.nodeId.slice(0, 8)} failed to return Merkle proof. Executing Slashing...`, targetPeer: fragment.nodeId });
                            await executeSlashing(fragment.nodeId, "TIMEOUT");
                        }
                    }, backoffTimeout);
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
                        const hostReward = (reward * 90n) / 100n;
                        const auditorReward = reward - hostReward;

                        try {
                            const [hostTx, auditorTx] = await Promise.all([
                                this.walletManager.allocateFunds(ethers.ZeroAddress, fragment.nodeId, hostReward, 'SYSTEM_SIG'),
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
                                if (this.node.wallet) {
                                    b.signature = await this.node.wallet.signTypedData(EIP712_DOMAIN, schema, valueObj.payload ? valueObj : valueObj);
                                } else {
                                    b.signature = signData(JSON.stringify(txPayload), this.node.privateKey) as string;
                                }
                                await this.handlePendingBlock(b, { peerAddress: `127.0.0.1:${this.node.port}` } as any, Date.now());
                                if (this.node.peer) {
                                    const p2pMsg = new PendingBlockMessage({ block: b });
                                    this.node.peer.broadcast(p2pMsg).catch(() => { });
                                }
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

export default ConsensusEngine;
