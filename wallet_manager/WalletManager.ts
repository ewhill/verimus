import * as crypto from 'crypto';

import { BLOCK_TYPES } from '../constants';
import type Ledger from '../ledger/Ledger';
import logger from '../logger/Logger';
import type { TransactionPayload, StorageContractBlock, StorageContractPayload, StakingContractPayload, SlashingPayload, Block } from '../types';


export default class WalletManager {
    private ledger: Ledger;
    private frozenEscrows: Map<string, { peerId: string; amount: number }[]> = new Map();

    constructor(ledger: Ledger) {
        this.ledger = ledger;
        // Map synchronous listeners
        this.ledger.events.on('blockAdded', (_unusedBlock: Block) => {
            // (Keep for other non-async listeners or legacy integrations if any, but we ignore updating state here)
        });
        
        // Map deterministic async subscriber explicitly
        this.ledger.blockAddedSubscribers.push(async (block: Block) => {
            await this.updateIncrementalState(block);
        });
    }

    async updateIncrementalState(block: Block): Promise<void> {
        if (!this.ledger.balancesCollection) return;
        const balances = this.ledger.balancesCollection;
        const activeContracts = this.ledger.activeContractsCollection;

        if (block.type === BLOCK_TYPES.TRANSACTION) {
            const p = block.payload as TransactionPayload;
            if (p.senderId !== 'SYSTEM') {
                await balances.updateOne({ publicKey: p.senderId }, { $inc: { balance: -p.amount } }, { upsert: true });
            }
            if (p.recipientId !== 'SYSTEM') {
                await balances.updateOne({ publicKey: p.recipientId }, { $inc: { balance: p.amount } }, { upsert: true });
            }
        } else if (block.type === BLOCK_TYPES.STORAGE_CONTRACT) {
            const p = block.payload as StorageContractPayload;
            if (activeContracts) {
                await activeContracts.updateOne({ contractId: block.hash }, { $set: { payload: p, publicKey: block.publicKey } }, { upsert: true });
            }
            const escrowToDeduct = p.remainingEgressEscrow ?? p.allocatedEgressEscrow ?? 0;
            if (escrowToDeduct > 0 && p.ownerAddress) {
                const findersFee = Math.max(0.000001, escrowToDeduct * 0.05); // 5% finder's fee mechanically
                const totalCost = escrowToDeduct + findersFee;
                
                await balances.updateOne({ publicKey: p.ownerAddress }, { $inc: { balance: -totalCost } }, { upsert: true });
                await balances.updateOne({ publicKey: block.publicKey }, { $inc: { balance: findersFee } }, { upsert: true });
                
                if (p.fragmentMap && p.fragmentMap.length > 0) {
                    const nodeShare = escrowToDeduct / p.fragmentMap.length;
                    for (const frag of p.fragmentMap) {
                        await balances.updateOne({ publicKey: frag.nodeId }, { $inc: { balance: -nodeShare } }, { upsert: true });
                    }
                }
            }
        } else if (block.type === BLOCK_TYPES.STAKING_CONTRACT) {
            const p = block.payload as StakingContractPayload;
            if (p.collateralAmount) {
                await balances.updateOne({ publicKey: p.operatorPublicKey }, { $inc: { balance: -p.collateralAmount } }, { upsert: true });
            }
        } else if (block.type === BLOCK_TYPES.SLASHING_TRANSACTION) {
            const p = block.payload as SlashingPayload;
            if (p.burntAmount) {
                await balances.updateOne({ publicKey: p.penalizedPublicKey }, { $inc: { balance: -p.burntAmount } }, { upsert: true });
            }
        }
    }

    async calculateBalance(peerId: string): Promise<number> {
        if (peerId === 'SYSTEM') {
            return Infinity;
        }

        let balance = 0;

        try {
            if (this.ledger.balancesCollection) {
                const record = await this.ledger.balancesCollection.findOne({ publicKey: peerId });
                if (record && record.balance) {
                    balance = record.balance;
                }
            }
        } catch (error) {
            logger.error(`Error calculating balance for peer ${peerId}: ${(error as Error).message}`);
        }

        // Deduct locally frozen escrows executing limit order bounds
        for (const escrows of this.frozenEscrows.values()) {
            for (const escrow of escrows) {
                if (escrow.peerId === peerId) {
                    balance -= escrow.amount;
                }
            }
        }

        return balance;
    }

    /**
     * Runs a boundary check against the calculateBalance output.
     * @param peerId Origins peer verification check
     * @param minimumRequired Numerical token bounding 
     * @returns True if funds exceed or match the minimum constraint
     */
    async verifyFunds(peerId: string, minimumRequired: number): Promise<boolean> {
        if (peerId === 'SYSTEM') {
            return true;
        }
        const balance = await this.calculateBalance(peerId);
        return balance >= minimumRequired;
    }

    /**
     * Calculates the exponential continuous decay of the System allocation rate representing physical Kryders Law half-lives
     * @param blockTimestamp Absolute milliseconds since epoch timing current mint
     * @param genesisTimestamp Absolute milliseconds mapping originating node genesis
     * @returns Base normalized numerical output mapping exact block rewards 
     */
    static calculateSystemReward(blockTimestamp: number, genesisTimestamp: number): number {
        const BASE_REWARD = 50.0;

        // 4 years in milliseconds to represent the physical half-life
        const FOUR_YEARS_MS = 4 * 365.25 * 24 * 60 * 60 * 1000;

        // Calculate the 'decay constant' lambda (λ) for a 4-year half-life
        // lambda = ln(2) / half_life
        const DECAY_RATE = Math.LN2 / FOUR_YEARS_MS;

        const timeDeltaMs = Math.max(0, blockTimestamp - genesisTimestamp);

        // N(t) = N0 * e^(-λt)
        const reward = BASE_REWARD * Math.exp(-DECAY_RATE * timeDeltaMs);

        // Establish a dust limit (minimum mint floor)
        return Math.max(reward, 0.000001);
    }

    /**
     * Builds an outgoing TRANSACTION block configuration mapping
     * @param senderId Outbound source
     * @param recipientId Inbound destination
     * @param amount Float mapped volume 
     * @param senderSignature Cryto verification
     * @returns Configures transaction payload mapped
     */
    async allocateFunds(senderId: string, recipientId: string, amount: number, senderSignature: string): Promise<TransactionPayload | null> {
        const hasFunds = await this.verifyFunds(senderId, amount);

        if (!hasFunds && senderId !== 'SYSTEM') {
            logger.warn(`Peer ${senderId} attempted allocation of ${amount} without adequate limits.`);
            return null;
        }

        return {
            senderId,
            recipientId,
            amount,
            senderSignature
        };
    }

    async deductEgressEscrow(blockHash: string, calculatedCost: number): Promise<void> {
        if (!this.ledger.collection || !this.ledger.activeContractsCollection || !this.ledger.balancesCollection) return;
        if (calculatedCost <= 0) return;

        const block = await this.ledger.collection.findOne({ hash: blockHash }) as StorageContractBlock | null;
        if (!block || !block.payload) return;

        const p = block.payload as StorageContractPayload;
        const currentRemaining = p.remainingEgressEscrow ?? p.allocatedEgressEscrow ?? 0;

        const newRemaining = Math.max(0, currentRemaining - calculatedCost);
        const actualDeduction = currentRemaining - newRemaining;

        await this.ledger.collection.updateOne(
            { hash: blockHash },
            { $set: { "payload.remainingEgressEscrow": newRemaining } }
        );

        await this.ledger.activeContractsCollection.updateOne(
            { contractId: blockHash },
            { $set: { "payload.remainingEgressEscrow": newRemaining } }
        );

        if (actualDeduction > 0) {
            await this.ledger.balancesCollection.updateOne(
                { publicKey: block.publicKey },
                { $inc: { balance: actualDeduction } },
                { upsert: true }
            );
        }
    }

    async buildStateRoot(): Promise<{ stateMerkleRoot: string, activeContractsMerkleRoot: string }> {
        if (!this.ledger.balancesCollection || !this.ledger.activeContractsCollection) {
            return { stateMerkleRoot: '', activeContractsMerkleRoot: '' };
        }
        
        // Exclude system accounts or Mongo IDs explicitly during mapping
        const stateStream = await this.ledger.balancesCollection.find({}, { projection: { _id: 0 } }).sort({ publicKey: 1 }).toArray();
        const stateStr = JSON.stringify(stateStream);
        const stateMerkleRoot = crypto.createHash('sha256').update(stateStr).digest('hex');

        const contractsStream = await this.ledger.activeContractsCollection.find({}, { projection: { _id: 0 } }).sort({ contractId: 1 }).toArray();
        const contractsStr = JSON.stringify(contractsStream);
        const activeContractsMerkleRoot = crypto.createHash('sha256').update(contractsStr).digest('hex');

        return { stateMerkleRoot, activeContractsMerkleRoot };
    }

    /**
     * Freezes a portion of the user's available balance into a temporary memory map during active Market negotiations.
     * Prevents double-spend exploitation where the user triggers concurrent network storage uploads.
     * @param peerId The Originator's public identifier
     * @param amount The theoretical maximum byte ceiling of the contract
     * @param requestId Bounding UUID tracking limit orders
     */
    freezeFunds(peerId: string, amount: number, requestId: string): void {
        if (peerId === 'SYSTEM') return;
        if (!this.frozenEscrows.has(requestId)) {
            this.frozenEscrows.set(requestId, []);
        }
        this.frozenEscrows.get(requestId)!.push({ peerId, amount });
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
}
