import type { Block, TransactionBlock, TransactionPayload } from '../types';
import type Ledger from '../ledger/Ledger';
import logger from '../logger/Logger';

export default class WalletManager {
    private ledger: Ledger;

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
        let balance = 0;

        try {
            if (!this.ledger.collection) {
                return 0; // Prevent querying against uninitialized local structures
            }

            const transactions = await this.ledger.collection.find({
                type: 'TRANSACTION',
                $or: [
                    { 'payload.senderId': peerId },
                    { 'payload.recipientId': peerId }
                ]
            }).toArray() as unknown as TransactionBlock[];

            for (const block of transactions) {
                if (block.payload?.senderId === peerId) {
                    balance -= block.payload.amount;
                }
                if (block.payload?.recipientId === peerId) {
                    balance += block.payload.amount;
                }
            }

        } catch (error) {
            logger.error(`Error calculating balance for peer ${peerId}: ${(error as Error).message}`);
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
        const balance = await this.calculateBalance(peerId);
        return balance >= minimumRequired;
    }

    /**
     * Builds an outgoing TRANSACTION block configuration mapping
     * @param senderId Outbound source
     * @param recipientId Inbound destination
     * @param amount Float mapped volume 
     * @param senderSignature Cryto verification
     * @returns Configures transaction payload mapped cleanly
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
}
