import * as crypto from 'crypto';

import { ethers } from 'ethers';

import { BLOCK_TYPES } from '../constants';
import type Ledger from '../ledger/Ledger';
import logger from '../logger/Logger';
import type { TransactionPayload, StorageContractBlock, StorageContractPayload, StakingContractPayload, SlashingPayload, Block } from '../types';

export default class WalletManager {
    private ledger: Ledger;
    private frozenEscrows: Map<string, { address: string; amount: bigint; allocatedRestToll?: bigint; startBlockHeight?: bigint; expirationBlockHeight?: bigint; }[]> = new Map();

    constructor(ledger: Ledger) {
        this.ledger = ledger;
        // Map synchronous listeners
        this.ledger.events.on('blockAdded', (_unusedBlock: Block) => {
            // (Keep for other non-async listeners or legacy integrations if any, but we ignore updating state here)
        });

        // Map deterministic async subscriber explicitly
        this.ledger.blockAddedSubscribers.push(async (block: Block) => {
            await this.updateIncrementalState(block);
            await this.processEpochTick(block.metadata.index);
        });
    }

    private getAddressSafe(address: string): string {
        if (!address) return '';
        if (address === ethers.ZeroAddress) return address;
        if (address.includes('BEGIN PUBLIC KEY') || address.includes('BEGIN RSA PUBLIC KEY')) return address;
        if (address.startsWith('GENESIS_NODE')) return address;
        
        try {
            return ethers.getAddress(address);
        } catch ( _unusedErr ) {
            throw new Error(`Invalid checksum or EVM address: ${address}`);
        }
    }

    private async applyBalanceDelta(address: string, deltaWei: bigint, balancesCol: any): Promise<void> {
        const safeAddress = this.getAddressSafe(address);
        const record = await balancesCol.findOne({ walletAddress: safeAddress });
        let current = record && record.balance !== undefined ? BigInt(record.balance) : 0n;
        current += deltaWei;
        await balancesCol.updateOne({ walletAddress: safeAddress }, { $set: { balance: current.toString() } }, { upsert: true });
    }

    async updateIncrementalState(block: Block): Promise<void> {
        if (!this.ledger.balancesCollection) return;
        const balances = this.ledger.balancesCollection;
        const activeContracts = this.ledger.activeContractsCollection;
        const activeValidators = this.ledger.activeValidatorsCollection;

        if (block.type === BLOCK_TYPES.TRANSACTION) {
            const p = block.payload as TransactionPayload;
            const txAmt = BigInt(p.amount);
            if (p.senderAddress !== ethers.ZeroAddress) {
                await this.applyBalanceDelta(p.senderAddress, -txAmt, balances);
            }
            if (p.recipientAddress !== ethers.ZeroAddress) {
                await this.applyBalanceDelta(p.recipientAddress, txAmt, balances);
            }
        } else if (block.type === BLOCK_TYPES.STORAGE_CONTRACT) {
            const p = block.payload as StorageContractPayload;
            if (activeContracts) {
                await activeContracts.updateOne(
                    { contractId: block.hash }, 
                    { $set: { 
                        payload: p, 
                        signerAddress: this.getAddressSafe(block.signerAddress),
                        index: block.metadata?.index || -1,
                        timestamp: block.metadata?.timestamp || new Date().toISOString()
                    } }, 
                    { upsert: true }
                );
            }
            const escrowToDeductStr = p.remainingEgressEscrow ?? p.allocatedEgressEscrow ?? 0n;
            const escrowToDeduct = BigInt(escrowToDeductStr);
            if (escrowToDeduct > 0n && p.ownerAddress) {
                const feeRateBasis = p.brokerFeePercentage ? BigInt(p.brokerFeePercentage) : 100n; // default 1% (100 basis points)
                const _findersFeeRaw = (escrowToDeduct * feeRateBasis) / 10000n;
                const findersFee = _findersFeeRaw === 0n ? 1n : _findersFeeRaw;
                const totalCost = escrowToDeduct + findersFee;

                await this.applyBalanceDelta(p.ownerAddress, -totalCost, balances);
                await this.applyBalanceDelta(block.signerAddress, findersFee, balances);

                if (p.fragmentMap && p.fragmentMap.length > 0) {
                    const nodeShare = escrowToDeduct / BigInt(p.fragmentMap.length);
                    for (const frag of p.fragmentMap) {
                        const fragId = frag.nodeId || '';
                        const safeFragAddress = fragId.startsWith('0x') ? this.getAddressSafe(fragId) : fragId;
                        await this.applyBalanceDelta(safeFragAddress, -nodeShare, balances);
                    }
                }
            }
        } else if (block.type === BLOCK_TYPES.STAKING_CONTRACT) {
            const p = block.payload as StakingContractPayload;
            const colAmt = BigInt(p.collateralAmount);
            if (colAmt > 0n) {
                await this.applyBalanceDelta(p.operatorAddress, -colAmt, balances);
            }
        } else if (block.type === BLOCK_TYPES.SLASHING_TRANSACTION) {
            const p = block.payload as SlashingPayload;
            const burnAmt = BigInt(p.burntAmount);
            if (burnAmt > 0n) {
                await this.applyBalanceDelta(p.penalizedAddress, -burnAmt, balances);
                if (activeValidators) {
                    await activeValidators.deleteOne({ validatorAddress: p.penalizedAddress });
                }
            }
        } else if (block.type === BLOCK_TYPES.VALIDATOR_REGISTRATION) {
            const p = block.payload as import('../types').ValidatorRegistrationPayload;
            const stakeAmt = BigInt(p.stakeAmount);
            if (p.action === 'STAKE' && stakeAmt > 0n) {
                await this.applyBalanceDelta(p.validatorAddress, -stakeAmt, balances);
                if (activeValidators) {
                    await activeValidators.updateOne(
                        { validatorAddress: p.validatorAddress },
                        { $set: { stakeAmount: stakeAmt.toString() } },
                        { upsert: true }
                    );
                }
            } else if (p.action === 'UNSTAKE') {
                if (activeValidators) {
                    await activeValidators.deleteOne({ validatorAddress: p.validatorAddress });
                }
                // Escrow refunds map asynchronously via Epoch triggers not instantaneous block injections.
            }
        }
    }

    async calculateBalance(address: string): Promise<bigint> {
        let safeAddress = address;
        if (address === ethers.ZeroAddress) {
            // Represent infinity natively mathematically logically
            return ethers.parseUnits("999999999999", 18);
        } else {
            safeAddress = this.getAddressSafe(address);
        }

        // Ensure new organic users receive the required 50.0 EIP-191 bound natively across ALL peers, 
        // resolving the mempool rejection state divergence observed when only ORIGINATORs fund users.
        let balance = ethers.parseUnits("50", 18);

        try {
            if (this.ledger.balancesCollection) {
                const record = await this.ledger.balancesCollection.findOne({ walletAddress: safeAddress });
                if (record && record.balance !== undefined) {
                    balance = BigInt(record.balance);
                }
            }
        } catch (error) {
            logger.error(`Error calculating balance for address ${safeAddress}: ${(error as Error).message}`);
        }

        // Deduct locally frozen escrows executing limit order bounds
        for (const escrows of this.frozenEscrows.values()) {
            for (const escrow of escrows) {
                if (escrow.address === safeAddress) {
                    balance -= escrow.amount;
                    if (escrow.allocatedRestToll) {
                        balance -= escrow.allocatedRestToll;
                    }
                }
            }
        }

        return balance;
    }

    async verifyFunds(address: string, minimumRequired: bigint): Promise<boolean> {
        if (address === ethers.ZeroAddress) {
            return true;
        }
        const balance = await this.calculateBalance(address);
        return balance >= minimumRequired;
    }

    /**
     * Calculates the exponential continuous decay of the System allocation rate representing physical Kryders Law half-lives
     * @param blockTimestamp Absolute milliseconds since epoch timing current mint
     * @param genesisTimestamp Absolute milliseconds mapping originating node genesis
     * @returns Base normalized numerical output mapping exact block rewards 
     */
    static calculateSystemReward(blockTimestamp: number, genesisTimestamp: number): bigint {
        const BASE_REWARD = 50.0;

        // 4 years in milliseconds to represent the physical half-life
        const FOUR_YEARS_MS = 4 * 365.25 * 24 * 60 * 60 * 1000;

        // Calculate the 'decay constant' lambda (λ) for a 4-year half-life
        const DECAY_RATE = Math.LN2 / FOUR_YEARS_MS;

        const timeDeltaMs = Math.max(0, blockTimestamp - genesisTimestamp);

        // N(t) = N0 * e^(-λt)
        const rewardFloat = BASE_REWARD * Math.exp(-DECAY_RATE * timeDeltaMs);

        const safeFloat = Math.max(rewardFloat, 0.000001);
        
        // Parse float logically dynamically to standard Wei BigInt properly mapped gracefully
        return ethers.parseUnits(safeFloat.toFixed(18), 18);
    }

    async allocateFunds(senderAddress: string, recipientAddress: string, amount: bigint, senderSignature: string): Promise<TransactionPayload | null> {
        const safeSender = senderAddress === ethers.ZeroAddress ? senderAddress : this.getAddressSafe(senderAddress);
        const safeRecipient = recipientAddress === ethers.ZeroAddress ? recipientAddress : this.getAddressSafe(recipientAddress);

        const hasFunds = await this.verifyFunds(safeSender, amount);

        if (!hasFunds && safeSender !== ethers.ZeroAddress) {
            logger.warn(`Peer ${safeSender} attempted allocation of ${amount} without adequate limits.`);
            return null;
        }

        return {
            senderAddress: safeSender,
            recipientAddress: safeRecipient,
            amount,
            senderSignature
        };
    }

    async deductEgressEscrow(blockHash: string, calculatedCost: bigint): Promise<void> {
        if (!this.ledger.collection || !this.ledger.activeContractsCollection || !this.ledger.balancesCollection) return;
        if (calculatedCost <= 0n) return;

        const block = await this.ledger.collection.findOne({ hash: blockHash }) as StorageContractBlock | null;
        if (!block || !block.payload) return;

        const p = block.payload as StorageContractPayload;
        const currentRemainingStr = p.remainingEgressEscrow ?? p.allocatedEgressEscrow ?? 0n;
        const currentRemaining = BigInt(currentRemainingStr);

        const diff = currentRemaining - calculatedCost;
        const newRemaining = diff < 0n ? 0n : diff;
        const actualDeduction = currentRemaining - newRemaining;

        // Payload types natively enforce strings mapping safely inside db architectures explicitly smoothly
        await this.ledger.collection.updateOne(
            { hash: blockHash },
            { $set: { "payload.remainingEgressEscrow": newRemaining.toString() } }
        );

        await this.ledger.activeContractsCollection.updateOne(
            { contractId: blockHash },
            { $set: { "payload.remainingEgressEscrow": newRemaining.toString() } }
        );

        if (actualDeduction > 0n) {
            await this.applyBalanceDelta(block.signerAddress, actualDeduction, this.ledger.balancesCollection);
        }
    }

    async buildStateRoot(): Promise<{ stateMerkleRoot: string, activeContractsMerkleRoot: string }> {
        if (!this.ledger.balancesCollection || !this.ledger.activeContractsCollection) {
            return { stateMerkleRoot: '', activeContractsMerkleRoot: '' };
        }

        // Exclude system accounts or Mongo IDs explicitly during mapping
        const stateStream = await this.ledger.balancesCollection.find({}, { projection: { _id: 0 } }).sort({ address: 1 }).toArray();
        const stateStr = JSON.stringify(stateStream);
        const stateMerkleRoot = crypto.createHash('sha256').update(stateStr).digest('hex');

        const contractsStream = await this.ledger.activeContractsCollection.find({}, { projection: { _id: 0 } }).sort({ contractId: 1 }).toArray();
        const contractsStr = JSON.stringify(contractsStream);
        const activeContractsMerkleRoot = crypto.createHash('sha256').update(contractsStr).digest('hex');

        return { stateMerkleRoot, activeContractsMerkleRoot };
    }

    freezeFunds(address: string, amount: bigint, requestId: string, allocatedRestToll: bigint = 0n, startBlockHeight: bigint = 0n, expirationBlockHeight: bigint = 0n): void {
        const safeAddr = address === ethers.ZeroAddress ? address : this.getAddressSafe(address);
        if (safeAddr === ethers.ZeroAddress) return;
        if (!this.frozenEscrows.has(requestId)) {
            this.frozenEscrows.set(requestId, []);
        }
        this.frozenEscrows.get(requestId)!.push({ address: safeAddr, amount, allocatedRestToll, startBlockHeight, expirationBlockHeight });
    }

    /**
     * Releases froze temporary limit orders returning funds to the pool if handshakes timeout or crash.
     * @param requestId Bounding limit UUID 
     */
    releaseFunds(requestId: string): void {
        this.frozenEscrows.delete(requestId);
    }

    /**
     * Executed when the overarching network mints the Contract. The underlying Ledger array intrinsically maps the 
     * cost, so the memory lock is purely expunged preventing duplicate tracking. 
     * @param requestId Boundary UUID mapped to storage negotiations
     */
    commitFunds(requestId: string): void {
        this.frozenEscrows.delete(requestId);
    }

    async processEpochTick(currentBlockIndex: number): Promise<void> {
        if (!this.ledger.activeContractsCollection || !this.ledger.balancesCollection) return;

        const contracts = await this.ledger.activeContractsCollection.find({}).toArray();
        for (const contract of contracts) {
            const p = contract.payload as StorageContractPayload;
            if (p.allocatedRestToll && p.expirationBlockHeight) {
                const startHeight = contract.startBlockHeight !== undefined ? BigInt(contract.startBlockHeight) : BigInt(contract.index);
                const expiryHeight = BigInt(p.expirationBlockHeight);
                const restToll = BigInt(p.allocatedRestToll);
                
                if (restToll > 0n && expiryHeight > startHeight && BigInt(currentBlockIndex) <= expiryHeight) {
                    const payoutWei = restToll / (expiryHeight - startHeight);
                    
                    if (payoutWei > 0n && p.fragmentMap && p.fragmentMap.length > 0) {
                        const remaining = restToll - payoutWei;
                        await this.ledger.activeContractsCollection.updateOne(
                            { contractId: contract.contractId },
                            { $set: { 
                                  "payload.allocatedRestToll": remaining.toString(),
                                  "startBlockHeight": currentBlockIndex.toString() 
                              } 
                            }
                        );

                        const nodeShare = payoutWei / BigInt(p.fragmentMap.length);
                        if (nodeShare > 0n) {
                            for (const frag of p.fragmentMap) {
                                const fragId = frag.nodeId || '';
                                const safeFragAddress = fragId.startsWith('0x') ? this.getAddressSafe(fragId) : fragId;
                                await this.applyBalanceDelta(safeFragAddress, nodeShare, this.ledger.balancesCollection);
                            }
                        }
                    }
                }
            }
        }
    }
}
