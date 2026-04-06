import { Request, Response } from 'express';

import { BLOCK_TYPES } from '../../constants';
import WalletManager from '../../wallet_manager/WalletManager';
import BaseHandler from '../base_handler/BaseHandler';

export default class WalletHandler extends BaseHandler {
    constructor(node: any) {
        super(node);
        this.handle = this.handle.bind(this);
    }

    async handle(req: Request, res: Response) {
        try {
            let targetAddress = (req.query.address as string) || this.node.walletAddress;
            if (targetAddress && targetAddress.startsWith('0x')) {
                targetAddress = targetAddress.toLowerCase();
            }
            if (!targetAddress) {
                return res.json({ success: false, message: 'Identity not initialized' });
            }

            // 1. Calculate continuous VERI balance
            const balance = await this.node.consensusEngine.walletManager.calculateBalance(targetAddress);

            // 2. Fetch active Emission limits mapping the discrete O(1) constraints
            const latestBlock = await this.node.ledger.getLatestBlock();
            const currentBlockTime = latestBlock ? latestBlock.metadata.timestamp : Date.now();
            const genesisTime = 1700000000000; // Static epoch bound from Ledger.ts
            const emissionRate = WalletManager.calculateSystemReward(currentBlockTime, genesisTime);

            // 3. Extract transaction ledger history locally
            let transactions: any[] = [];
            if (this.node.ledger.collection) {
                const txBlocks = await this.node.ledger.collection.find({
                    type: BLOCK_TYPES.TRANSACTION,
                    $or: [
                        { 'payload.senderAddress': targetAddress },
                        { 'payload.recipientAddress': targetAddress }
                    ]
                }).sort({ "metadata.index": -1 }).limit(100).toArray();

                transactions = txBlocks.map((b: any) => ({
                    hash: b.hash,
                    timestamp: b.metadata.timestamp,
                    senderAddress: b.payload.senderAddress,
                    recipientAddress: b.payload.recipientAddress,
                    amount: b.payload.amount
                }));
            }

            res.json({
                success: true,
                balance,
                emissionRate,
                transactions
            });
        } catch (error: any) {
            console.error('[API Error] /api/wallet:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
