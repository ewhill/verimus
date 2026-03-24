import * as crypto from 'crypto';

import { AdoptForkMessage } from '../../messages/adopt_fork_message/AdoptForkMessage';
import { GENESIS_TIMESTAMP } from '../../constants';
import { hashData, signData, verifySignature } from '../../crypto_utils/CryptoUtils';
import logger from '../../logger/Logger';
import Mempool from '../../models/mempool/Mempool';
import PeerNode from '../../peer_node/PeerNode';
import { PendingBlockMessage } from '../../messages/pending_block_message/PendingBlockMessage';
import { ProposeForkMessage } from '../../messages/propose_fork_message/ProposeForkMessage';
import type { Block, PeerConnection, TransactionPayload } from '../../types';
import { VerifyBlockMessage } from '../../messages/verify_block_message/VerifyBlockMessage';
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

    constructor(peerNode: PeerNode) {
        this.node = peerNode;
        this.mempool = peerNode.mempool;
        this.committing = false;
        this.proposalTimeout = null;
        this.walletManager = new WalletManager(peerNode.ledger);
    }

    bindHandlers() {
        this.node.peer?.bind(PendingBlockMessage).to(async (m: PendingBlockMessage, c: PeerConnection) => this.handlePendingBlock(m.block, c, (m as any).header?.timestamp.getTime()));
        this.node.peer?.bind(VerifyBlockMessage).to(async (m: VerifyBlockMessage, c: PeerConnection) => this.handleVerifyBlock(m.blockId, m.signature, c));
        this.node.peer?.bind(ProposeForkMessage).to(async (m: ProposeForkMessage, c: PeerConnection) => this.handleProposeFork(m.forkId, m.blockIds, c));
        this.node.peer?.bind(AdoptForkMessage).to(async (m: AdoptForkMessage, c: PeerConnection) => this.handleAdoptFork(m.forkId, m.finalTipHash, c));
    }

    async handlePendingBlock(block: Block, connection: PeerConnection, headerTimestamp: number) {
        if (this.node.syncEngine && this.node.syncEngine.isSyncing) {
            this.node.syncEngine.syncBuffer.push({ type: 'PendingBlock', block, connection, timestamp: headerTimestamp });
            return;
        }

        if (!block || !block.publicKey || !block.signature || !block.payload || !block.metadata) {
            logger.info(`[Peer ${this.node.port}] Rejected structurally malformed block from ${connection.peerAddress}`);
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
        delete (blockToHash as any)._id;
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

        if (block.type === 'TRANSACTION') {
            const txPayload = block.payload as TransactionPayload;
            const hasFunds = await this.walletManager.verifyFunds(txPayload.senderId, txPayload.amount);
            if (!hasFunds && txPayload.senderId !== 'SYSTEM') {
                logger.warn(`[Peer ${this.node.port}] Rejected Transaction: Insufficient Funds from ${txPayload.senderId}`);
                await this.node.reputationManager.penalizeMajor(block.publicKey, "Insufficient Funds Double Spend");
                return;
            }
        }

        await this.node.reputationManager.rewardHonestProposal(block.publicKey);

        if (!this.mempool.pendingBlocks.has(blockId)) {
            this.mempool.pendingBlocks.set(blockId, {
                block: block,
                verifications: new Set(),
                originalTimestamp: headerTimestamp ? new Date(headerTimestamp).getTime() : Date.now()
            });
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

        pendingEntry.verifications.add(connection.peerAddress);
        logger.info(`[Peer ${this.node.port}] Verification for ${blockId.slice(0, 8)} from ${connection.peerAddress}. Total: ${pendingEntry.verifications.size}`);

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
        let hasStorageContract = false;
        for (const [bId, pEntry] of this.mempool.pendingBlocks.entries()) {
            if (pEntry.eligible && !pEntry.committed) {
                eligibleBlockIds.push(bId);
                if (pEntry.block.type === 'CONTRACT') {
                    hasStorageContract = true;
                }
            }
        }

        if (eligibleBlockIds.length === 0) return;

        if (hasStorageContract) {
            const reward = WalletManager.calculateSystemReward(Date.now(), GENESIS_TIMESTAMP);
            
            const txPayload = await this.walletManager.allocateFunds('SYSTEM', this.node.publicKey, reward, 'SYSTEM_MINT');
            if (txPayload) {
                const sig = signData(JSON.stringify(txPayload), this.node.privateKey);
                const newBlock: Block = {
                    metadata: { index: -1, timestamp: Date.now() },
                    type: 'TRANSACTION',
                    payload: txPayload,
                    publicKey: this.node.publicKey,
                    signature: sig as string
                };
                
                const blockId = crypto.createHash('sha256').update(sig as string).digest('hex');
                
                this.mempool.pendingBlocks.set(blockId, {
                    block: newBlock,
                    verifications: new Set([`127.0.0.1:${this.node.port}`]),
                    originalTimestamp: Date.now(),
                    eligible: true,
                    committed: false
                });
                
                eligibleBlockIds.push(blockId);
            }
        }

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
        forkEntry!.proposals.add(connection.peerAddress);
        logger.info(`[Peer ${this.node.port}] Proposal for Fork ${forkId.slice(0, 8)} from ${connection.peerAddress}. Total: ${forkEntry!.proposals.size}`);

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
                    type: pEntry.block.type || 'CONTRACT',
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

        settledEntry!.adoptions.add(connection.peerAddress);
        logger.info(`[Peer ${this.node.port}] Adoption for Fork ${forkId.slice(0, 8)} from ${connection.peerAddress}. Total: ${settledEntry!.adoptions.size}`);

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
        } catch (error) {
            logger.error(`[Peer ${this.node.port}] Error committing fork ${forkId.slice(0, 8)}:`, error);
        } finally {
            this.committing = false;
        }
    }
}

export default ConsensusEngine;
