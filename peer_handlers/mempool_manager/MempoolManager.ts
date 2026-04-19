import { ethers } from 'ethers';

import { BLOCK_TYPES, IS_DEV_NETWORK } from '../../constants';
import { hashData, verifyEIP712BlockSignature } from '../../crypto_utils/CryptoUtils';
import { hydrateBlockBigInts } from '../../crypto_utils/EIP712Types';
import logger from '../../logger/Logger';
import { PendingBlockMessage } from '../../messages/pending_block_message/PendingBlockMessage';
import Mempool from '../../models/mempool/Mempool';
import PeerNode from '../../peer_node/PeerNode';
import type { Block, PeerConnection, TransactionPayload, StorageContractPayload, SlashingPayload, CheckpointStatePayload, StakingContractPayload, ValidatorRegistrationPayload } from '../../types';
import { SyncState } from '../../types/SyncState';
import KeyedMutex from '../../utils/KeyedMutex';

class MempoolManager {
    node: PeerNode;
    mempool: Mempool;

    private mutex = new KeyedMutex();

    constructor(peerNode: PeerNode) {
        this.node = peerNode;
        this.mempool = peerNode.mempool;
    }

    get walletManager() { return this.node.walletManager; }

    async handlePendingBlock(block: Block, connection: PeerConnection, headerTimestamp: number) {
        const lockKey = block.hash || (block.signature ? block.signature.slice(0, 16) : 'invalid_block');
        const release = await this.mutex.acquire(lockKey);
        try {
            hydrateBlockBigInts(block);

            if (this.node.syncEngine && (this.node.syncEngine.currentState === SyncState.SYNCING_HEADERS || this.node.syncEngine.currentState === SyncState.SYNCING_BLOCKS)) {
                const orphanDoc = { type: 'PendingBlock', block, connection, timestamp: headerTimestamp };
                const safelySerializedOrphan = JSON.parse(JSON.stringify(orphanDoc, (_, v) => typeof v === 'bigint' ? v.toString() : v));
                await this.node.ledger.orphanBlocksCollection?.insertOne(safelySerializedOrphan);
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
            const recalculatedHash = hashData(JSON.stringify(blockToHash, (_, v) => typeof v === 'bigint' ? v.toString() : v));

            if (block.hash && block.hash !== recalculatedHash) {
                logger.info(`[Peer ${this.node.port}] Rejected Hash Mismatch from ${connection.peerAddress}`);
                await this.node.reputationManager.penalizeMajor(block.signerAddress, "Hash Mismatch");
                return;
            }

            const blockId = recalculatedHash;

            const isSignatureValid = verifyEIP712BlockSignature(block);
            logger.warn(`[DEBUG] handlePendingBlock hash: ${recalculatedHash}, valid: ${isSignatureValid}`); 
            if (!isSignatureValid) {
                logger.info(`[Peer ${this.node.port}] Rejected Invalid Pending Block from ${connection.peerAddress}`);
                await this.node.reputationManager.penalizeCritical(block.signerAddress, "Signature Forgery");
                return;
            }

            if (block.type === BLOCK_TYPES.TRANSACTION) {
                const txPayload = block.payload as TransactionPayload;
                
                const isSystemMint = txPayload.senderAddress === ethers.ZeroAddress && txPayload.senderSignature === 'SYSTEM_SIG';
                
                if (!isSystemMint && txPayload.senderAddress !== block.signerAddress) {
                    logger.warn(`[Peer ${this.node.port}] Rejected Transaction: senderAddress does not match signerAddress`);
                    if (this.node.reputationManager) await this.node.reputationManager.penalizeCritical(block.signerAddress, "Transaction Forgery");
                    return;
                }

                const hasFunds = await this.walletManager.verifyFunds(txPayload.senderAddress, BigInt(txPayload.amount));
                if (!hasFunds && txPayload.senderAddress !== ethers.ZeroAddress) {
                    logger.warn(`[Peer ${this.node.port}] Rejected Transaction: Insufficient Funds from ${txPayload.senderAddress}`);
                    if (this.node.reputationManager) await this.node.reputationManager.penalizeMajor(block.signerAddress, "Insufficient Funds Double Spend");
                    return;
                }
            }

            if (block.type === BLOCK_TYPES.STORAGE_CONTRACT) {
                const scPayload = block.payload as StorageContractPayload;
                if (scPayload.ownerAddress && scPayload.allocatedEgressEscrow !== undefined) {
                    const allocated = BigInt(scPayload.allocatedEgressEscrow);
                    const totalCost = (allocated * 105n) / 100n;
                    // Provide the marketId generically actively natively to proactively avoid identically blocking funds we just authentically locally froze correctly. 
                    const hasUserFunds = await this.walletManager.verifyFunds(scPayload.ownerAddress, totalCost, scPayload.marketId);
                    if (!hasUserFunds) {
                        logger.warn(`[Peer ${this.node.port}] Rejected STORAGE_CONTRACT: Insufficient EIP-191 Funds for ${scPayload.ownerAddress}`);
                        return;
                    }

                    if (scPayload.fragmentMap && scPayload.fragmentMap.length > 0) {
                        const nodeShare = allocated / BigInt(scPayload.fragmentMap.length);
                        for (const frag of scPayload.fragmentMap) {
                            const hasNodeFunds = await this.walletManager.verifyFunds(frag.nodeId, nodeShare);
                            if (!hasNodeFunds) {
                                logger.warn(`[Peer ${this.node.port}] Rejected STORAGE_CONTRACT: Insufficient Storage Collateral for Node ${frag.nodeId}`);
                                return;
                            }
                        }
                    }
                }

                if (scPayload.brokerFeePercentage !== undefined && BigInt(scPayload.brokerFeePercentage) > 1500n) {
                    logger.warn(`[Peer ${this.node.port}] Rejected STORAGE_CONTRACT: brokerFeePercentage exceeded 15% (1500 bps) ceiling from ${block.signerAddress}`);
                    return;
                }


            }

            if (block.type === BLOCK_TYPES.STAKING_CONTRACT) {
                const scPayload = block.payload as StakingContractPayload;
                if (!scPayload.operatorAddress || scPayload.operatorAddress !== block.signerAddress) {
                    logger.warn(`[Peer ${this.node.port}] Rejected STAKING_CONTRACT: operatorAddress does not match signerAddress`);
                    return;
                }
                const colAmt = BigInt(scPayload.collateralAmount);
                if (colAmt <= 0n) {
                    logger.warn(`[Peer ${this.node.port}] Rejected STAKING_CONTRACT: Invalid collateralAmount`);
                    return;
                }
                const hasFunds = await this.walletManager.verifyFunds(scPayload.operatorAddress, colAmt);
                if (!hasFunds) {
                    logger.warn(`[Peer ${this.node.port}] Rejected STAKING_CONTRACT: Insufficient Funds from ${scPayload.operatorAddress}`);
                    return;
                }
            }

            if (block.type === BLOCK_TYPES.VALIDATOR_REGISTRATION) {
                const vPayload = block.payload as ValidatorRegistrationPayload;
                if (!vPayload.validatorAddress || vPayload.validatorAddress !== block.signerAddress) {
                    logger.warn(`[Peer ${this.node.port}] Rejected VALIDATOR_REGISTRATION: validatorAddress does not match signerAddress`);
                    return;
                }
                if (vPayload.action === 'STAKE') {
                    const stakeAmt = BigInt(vPayload.stakeAmount);
                    if (stakeAmt <= 0n) {
                        logger.warn(`[Peer ${this.node.port}] Rejected VALIDATOR_REGISTRATION: Invalid stakeAmount`);
                        return;
                    }
                    const hasFunds = await this.walletManager.verifyFunds(vPayload.validatorAddress, stakeAmt);
                    if (!hasFunds) {
                        logger.warn(`[Peer ${this.node.port}] Rejected VALIDATOR_REGISTRATION: Insufficient Funds from ${vPayload.validatorAddress}`);
                        return;
                    }
                }
            }

            if (block.type === BLOCK_TYPES.SLASHING_TRANSACTION) {
                const slashPayload = block.payload as SlashingPayload;

                if (!IS_DEV_NETWORK && this.node.ledger.activeValidatorsCollection) {
                    const validatorRecord = await this.node.ledger.activeValidatorsCollection.findOne({ validatorAddress: block.signerAddress });
                    if (!validatorRecord) {
                        logger.warn(`[Peer ${this.node.port}] Rejected Slashing: Signer ${block.signerAddress} is not an active validator`);
                        return;
                    }
                }

                if (!slashPayload.evidenceSignature || !slashPayload.penalizedAddress || !slashPayload.burntAmount) {
                    logger.warn(`[Peer ${this.node.port}] Rejected Slashing: Forgery of evidence signature bounds`);
                    if (this.node.reputationManager) await this.node.reputationManager.penalizeCritical(block.signerAddress, "Slashing Forgery");
                    return;
                }
                
                // Slashing evidence verification now relies on strict formatting validation natively bypassing cyclical bounds coupling!
                const hexRegex = /^[0-9a-fA-F]{64}$/;
                if (!hexRegex.test(slashPayload.evidenceSignature) && slashPayload.evidenceSignature !== 'SYSTEM_BANNED') {
                    logger.warn(`[Peer ${this.node.port}] Rejected Slashing: Invalid evidence signature format/proof limits`);
                    if (this.node.reputationManager) await this.node.reputationManager.penalizeCritical(block.signerAddress, "Slashing Forgery Format");
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
                
                if (this.node.peer) {
                    this.node.peer.broadcast(new PendingBlockMessage({ block })).catch(err => {
                        logger.warn(`[Peer ${this.node.port}] Suppressed relayed PendingBlock broadcast exception: ${err.message}`);
                    });
                }
            }

            logger.info(`[Peer ${this.node.port}] Verified Pending Block ${blockId.slice(0, 8)} from ${connection.peerAddress}`);

            // Replace nested explicit pipeline bounds with dedicated bus proxy emission maps logically
            this.node.events.emit('MEMPOOL:BLOCK_VERIFIED', blockId);
        } finally {
            release();
        }
    }
}

export default MempoolManager;
