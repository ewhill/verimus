import { BLOCK_TYPES } from '../constants';
import type Ledger from '../ledger/Ledger';
import logger from '../logger/Logger';
import type { Block, TransactionBlock, TransactionPayload, StorageContractBlock, StorageContractPayload } from '../types';


export default class WalletManager {
    private ledger: Ledger;
    private frozenEscrows: Map<string, { peerId: string; amount: number }> = new Map();

    constructor(ledger: Ledger) {
        this.ledger = ledger;
    }

    /**
     * Calculates the deterministic token balance of a peer by sweeping the public blockchain.
     * Genesis injections act as base token creation events.
     * @param peerId The public key hash or ID of the peer
     * @returns The floating-point token map of the peer's actual network wealth 
     */
    async calculateBalance(peerId: string): Promise<number> {
        if (peerId === 'SYSTEM') {
            return Infinity;
        }

        let balance = 0;

        try {
            if (!this.ledger.collection) {
                return 0; // Prevent querying against uninitialized local structures
            }

            const transactions = await this.ledger.collection.find({
                type: BLOCK_TYPES.TRANSACTION,
                $or: [
                    { 'payload.senderId': peerId },
                    { 'payload.recipientId': peerId }
                ]
            }).toArray() as TransactionBlock[];

            for (const block of transactions) {
                if (block.payload?.senderId === peerId) {
                    balance -= block.payload.amount;
                }
                if (block.payload?.recipientId === peerId) {
                    balance += block.payload.amount;
                }
            }

            // Deduct dynamic public escrow costs reserved exclusively mapping physical chunks limiting runaway downloads
            const activeContracts = await this.ledger.collection.find({
                type: BLOCK_TYPES.STORAGE_CONTRACT,
                publicKey: peerId,
                'payload.remainingEgressEscrow': { $gt: 0 }
            }).toArray() as StorageContractBlock[];

            for (const contract of activeContracts) {
                if (contract.payload?.remainingEgressEscrow) {
                    balance -= contract.payload.remainingEgressEscrow;
                }
            }

        } catch (error) {
            logger.error(`Error calculating balance for peer ${peerId}: ${(error as Error).message}`);
        }

        // Deduct locally frozen escrows executing limit order bounds
        for (const escrow of this.frozenEscrows.values()) {
            if (escrow.peerId === peerId) {
                balance -= escrow.amount;
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

    /**
     * Deducts calculated stream costs from a block's allocated egress escrow atomically.
     * @param blockHash The target contract block bounding the extraction.
     * @param calculatedCost Float numerical reduction to apply.
     */
    async deductEgressEscrow(blockHash: string, calculatedCost: number): Promise<void> {
        if (!this.ledger.collection) return;
        if (calculatedCost <= 0) return;

        const block = await this.ledger.collection.findOne({ hash: blockHash }) as StorageContractBlock | null;
        if (!block || !block.payload) return;

        const p = block.payload as StorageContractPayload;
        const currentRemaining = p.remainingEgressEscrow ?? p.allocatedEgressEscrow ?? 0;

        const newRemaining = Math.max(0, currentRemaining - calculatedCost);

        await this.ledger.collection.updateOne(
            { hash: blockHash },
            { $set: { "payload.remainingEgressEscrow": newRemaining } }
        );
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
        this.frozenEscrows.set(requestId, { peerId, amount });
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
