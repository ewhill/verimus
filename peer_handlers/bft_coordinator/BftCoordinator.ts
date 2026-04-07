import * as crypto from 'crypto';

import { BLOCK_TYPES } from '../../constants';
import { hashData, signData } from '../../crypto_utils/CryptoUtils';
import { EIP712_DOMAIN, EIP712_SCHEMAS, normalizeBlockForSignature } from '../../crypto_utils/EIP712Types';
import logger from '../../logger/Logger';
import { AdoptForkMessage } from '../../messages/adopt_fork_message/AdoptForkMessage';
import { ProposeForkMessage } from '../../messages/propose_fork_message/ProposeForkMessage';
import { VerifyBlockMessage } from '../../messages/verify_block_message/VerifyBlockMessage';
import Mempool from '../../models/mempool/Mempool';
import PeerNode from '../../peer_node/PeerNode';
import type { Block, CheckpointStatePayload, PeerConnection } from '../../types';
import KeyedMutex from '../../utils/KeyedMutex';

class BftCoordinator {
    node: PeerNode;
    mempool: Mempool;

    private activeForkTimeouts: Map<string, NodeJS.Timeout> = new Map();
    private proposalTimeout: NodeJS.Timeout | null = null;
    public committing: boolean = false;
    
    // Explicit localized fork-level isolation preventing overlapping parallel updates
    private mutex = new KeyedMutex();

    constructor(peerNode: PeerNode) {
        this.node = peerNode;
        this.mempool = peerNode.mempool;
    }

    get walletManager() { return this.node.walletManager; }

    start() {
        this.node.events.on('MEMPOOL:BLOCK_VERIFIED', async (blockId: string) => {
            try {
                const privateKey = this.node.privateKey;
                const myVerificationSig = signData(blockId, privateKey);
                
                await this.handleVerifyBlock(blockId, myVerificationSig as string, { peerAddress: `127.0.0.1:${this.node.port}` } as PeerConnection);

                if (this.mempool.orphanedVerifications.has(blockId)) {
                    const orphans = this.mempool.orphanedVerifications.get(blockId);
                    this.mempool.orphanedVerifications.delete(blockId);
                    for (const orphan of orphans!) {
                        await this.handleVerifyBlock(blockId, orphan.signature, orphan.connection);
                    }
                }

                if (this.node.peer) {
                    this.node.peer.broadcast(new VerifyBlockMessage({ blockId, signature: myVerificationSig as string })).catch(() => {});
                }
            } catch (err: any) {
                logger.warn(`[Peer ${this.node.port}] Local block verification failed synchronously: ${err.message}`);
            }
        });
    }
    
    async handleVerifyBlock(blockId: string, signature: string, connection: PeerConnection) {
        const release = await this.mutex.acquire(blockId);
        try {
            if (!blockId) return;

            const pendingEntry = this.mempool.pendingBlocks.get(blockId);
            if (!pendingEntry) {
                if (!this.mempool.orphanedVerifications.has(blockId)) {
                    this.mempool.orphanedVerifications.set(blockId, []);
                }
                this.mempool.orphanedVerifications.get(blockId)!.push({ signature, connection });
                return;
            }

            if (pendingEntry.verifications.has(connection.peerAddress)) return;

            pendingEntry.verifications.add(connection.peerAddress);

            const myAddress = `127.0.0.1:${this.node.port}`;
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
                this.proposalTimeout = setTimeout(async () => {
                    const releaseProp = await this.mutex.acquire('global_proposal');
                    try {
                        await this._checkAndProposeFork();
                    } finally {
                        this.proposalTimeout = null;
                        releaseProp();
                    }
                }, 500);
            }
        } finally {
            release();
        }
    }

    async _checkAndProposeFork() {
        if (this.node.syncEngine && this.node.syncEngine.isSyncing) return;

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

        const latestBlock = await this.node.ledger.getLatestBlock();
        const previousHash = latestBlock && latestBlock.hash ? latestBlock.hash : '0'.repeat(64);

        const targetBlockId = eligibleBlockIds[0];
        const tempBlockIds = [targetBlockId];

        const hashBase = crypto.createHash('sha256').update(tempBlockIds.join(',')).digest('hex').slice(0, 32);
        const forkId = `${hashBase}_${previousHash.slice(0, 16)}`;

        const forkEntry = this.mempool.eligibleForks.get(forkId);
        if (!forkEntry || !forkEntry.adopted) {
            this.handleProposeFork(forkId, tempBlockIds, { peerAddress: `127.0.0.1:${this.node.port}` } as PeerConnection).catch(() => {});
            if (this.node.peer) {
                this.node.peer.broadcast(new ProposeForkMessage({ forkId, blockIds: tempBlockIds })).catch(() => {});
            }

            if (this.activeForkTimeouts.has(forkId)) {
                clearTimeout(this.activeForkTimeouts.get(forkId)!);
            }

            const timeout = setTimeout(async () => {
                const releaseFork = await this.mutex.acquire(forkId);
                try {
                    this.activeForkTimeouts.delete(forkId);
                    logger.warn(`[Peer ${this.node.port}] P2P BFT Timeout Triggered for ${forkId.slice(0, 8)}. Demoting stalled proposal implicitly mathematically unlocking chain bounds.`);
                    this.mempool.eligibleForks.delete(forkId);
                    this.mempool.settledForks.delete(forkId);
                    await this._checkAndProposeFork();
                } finally {
                    releaseFork();
                }
            }, 10000).unref();

            this.activeForkTimeouts.set(forkId, timeout);
        }
    }

    async handleProposeFork(forkId: string, blockIds: string[], connection: PeerConnection) {
        const release = await this.mutex.acquire(forkId);
        try {
            if (this.node.syncEngine && this.node.syncEngine.isSyncing) {
                this.node.syncEngine.syncBuffer.push({ type: 'ProposeFork', forkId, blockIds, connection });
                return;
            }

            const tipConstraint = forkId && forkId.includes('_') ? forkId.split('_')[1] : null;
            if (tipConstraint) {
                const latestBlock = await this.node.ledger.getLatestBlock();
                const currentTip = latestBlock && latestBlock.hash ? latestBlock.hash.slice(0, 16) : '0'.repeat(16);
                if (currentTip !== tipConstraint) {
                    const existingFork = this.mempool.eligibleForks.get(forkId);
                    if (existingFork && existingFork.adopted) return;

                    if (this.node.syncEngine) {
                        this.node.syncEngine.syncBuffer.push({ type: 'ProposeFork', forkId, blockIds, connection });
                        this.node.syncEngine.performInitialSync().catch(() => { });
                    }
                    return;
                }
            }

            if (!this.mempool.eligibleForks.has(forkId)) {
                this.mempool.eligibleForks.set(forkId, { blockIds, proposals: new Set() });
            }

            const forkEntry = this.mempool.eligibleForks.get(forkId);
            if (forkEntry!.proposals.has(connection.peerAddress)) return;

            forkEntry!.proposals.add(connection.peerAddress);

            const myAddress = `127.0.0.1:${this.node.port}`;
            if (!forkEntry!.proposals.has(myAddress)) {
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

                this.handleAdoptFork(forkId, finalTipHash, { peerAddress: `127.0.0.1:${this.node.port}` } as PeerConnection).catch(() => {});

                const msg = new AdoptForkMessage({ forkId, finalTipHash });
                if (this.node.peer && this.node.peer.peers.length > 0) {
                    this.node.peer.broadcast(msg).catch(() => {});
                }

                const settledEntry = this.mempool.settledForks.get(forkId);
                if (settledEntry && settledEntry.pendingCommit && !settledEntry.committed) {
                    await this._commitFork(forkId);
                }
            }
        } finally {
            release();
        }
    }

    async handleAdoptFork(forkId: string, finalTipHash: string, connection: PeerConnection) {
        const release = await this.mutex.acquire(forkId);
        try {
            if (this.node.syncEngine && this.node.syncEngine.isSyncing) {
                this.node.syncEngine.syncBuffer.push({ type: 'AdoptFork', forkId, finalTipHash, connection });
                return;
            }

            const tipConstraint = forkId && forkId.includes('_') ? forkId.split('_')[1] : null;
            if (tipConstraint) {
                const latestBlock = await this.node.ledger.getLatestBlock();
                const currentTip = latestBlock && latestBlock.hash ? latestBlock.hash.slice(0, 16) : '0'.repeat(16);
                if (currentTip !== tipConstraint) {
                    const existingSettled = this.mempool.settledForks.get(forkId);
                    if (existingSettled && existingSettled.finalTipHash === finalTipHash) return;

                    if (this.node.syncEngine) {
                        this.node.syncEngine.syncBuffer.push({ type: 'AdoptFork', forkId, finalTipHash, connection });
                        this.node.syncEngine.performInitialSync().catch(() => { });
                    }
                    return;
                }
            }

            if (!this.mempool.settledForks.has(forkId)) {
                this.mempool.settledForks.set(forkId, { finalTipHash, adoptions: new Set() });
            }

            const settledEntry = this.mempool.settledForks.get(forkId);
            if (settledEntry!.finalTipHash !== finalTipHash) return;
            if (settledEntry!.adoptions.has(connection.peerAddress)) return;

            settledEntry!.adoptions.add(connection.peerAddress);

            if (this.node.peer && connection.peerAddress !== `127.0.0.1:${this.node.port}`) {
                this.node.peer.broadcast(new AdoptForkMessage({ forkId, finalTipHash })).catch(() => {});
            }

            const majority = this.node.getMajorityCount();
            if (settledEntry!.adoptions.size >= majority && !settledEntry!.committed) {
                const forkEntry = this.mempool.eligibleForks.get(forkId);
                if (forkEntry && forkEntry.computedBlocks) {
                    await this._commitFork(forkId);
                } else {
                    settledEntry!.pendingCommit = true;
                }
            }
        } finally {
            release();
        }
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
                this.mempool.eligibleForks.delete(forkId);
                this.mempool.settledForks.delete(forkId);
                this.committing = false;
                this._checkAndProposeFork().catch(() => {});
                return;
            }

            settledEntry.committed = true;
            logger.info(`[Peer ${this.node.port}] Fork ${forkId.slice(0, 8)} is SETTLED. Committing to database...`);
            for (const block of forkEntry.computedBlocks) {
                const existing = await this.node.ledger.collection!.findOne({ signature: block.signature });
                if (existing) {
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

                await this.node.ledger.addBlockToChain(block);

                if (block.type === BLOCK_TYPES.CHECKPOINT) {
                    await this.node.ledger.pruneHistory(block.metadata.index);
                } else {
                    const EPOCH_SIZE = 1000000;
                    if (block.metadata.index > 0 && block.metadata.index % EPOCH_SIZE === 0) {
                        if (block.signerAddress === this.node.walletAddress) {
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

                            // Directly inject checkpoint as verified into bridge implicitly natively
                            this.node.events.emit('NETWORK:INBOUND_PENDING_BLOCK', valBlock);
                        }
                    }
                }
            }

            for (let i = 0; i < forkEntry.blockIds.length; i++) {
                const bId = forkEntry.blockIds[i];
                const pEntry = this.mempool.pendingBlocks.get(bId);
                const computedBlock = forkEntry.computedBlocks[i];
                
                if (pEntry) {
                    pEntry.committed = true;
                    this.mempool.pendingBlocks.delete(bId);
                    
                    if (computedBlock) {
                        pEntry.block.hash = computedBlock.hash;
                        pEntry.block.metadata = computedBlock.metadata;
                    }
                    
                    this.node.events.emit(`settled:${bId}`, pEntry.block);
                }
            }

            this.committing = false;
            await this._checkAndProposeFork();

        } catch (_unusedError) {
            this.committing = false;
            this.mempool.eligibleForks.delete(forkId);
            this.mempool.settledForks.delete(forkId);
            if (forkEntry && forkEntry.blockIds) {
                for (const bId of forkEntry.blockIds) {
                    this.mempool.pendingBlocks.delete(bId);
                }
            }
            this._checkAndProposeFork().catch(() => {});
        }
    }
}

export default BftCoordinator;
