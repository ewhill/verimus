import { ethers } from 'ethers';
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
                try {
                    targetAddress = ethers.getAddress(targetAddress);
                } catch (_unusedErr) {
                    return res.json({ success: false, message: 'Invalid identity struct provided' });
                }
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
            let stakes: any[] = [];
            let totalPages = 1;
            
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 25;
            const skip = (page - 1) * limit;
            
            if (this.node.ledger.collection) {
                const query = {
                    type: BLOCK_TYPES.TRANSACTION,
                    $or: [
                        { 'payload.senderAddress': targetAddress },
                        { 'payload.recipientAddress': targetAddress }
                    ]
                };
                
                const totalDocs = await this.node.ledger.collection.countDocuments(query);
                totalPages = Math.ceil(totalDocs / limit) || 1;

                const txBlocks = await this.node.ledger.collection.find(query)
                    .sort({ "metadata.index": -1 })
                    .skip(skip)
                    .limit(limit)
                    .toArray();

                transactions = txBlocks.map((b: any) => ({
                    hash: b.hash,
                    timestamp: b.metadata.timestamp,
                    senderAddress: b.payload.senderAddress,
                    recipientAddress: b.payload.recipientAddress,
                    amount: b.payload.amount
                }));

                const stakeQuery = {
                    $or: [
                        { type: BLOCK_TYPES.STAKING_CONTRACT, 'payload.operatorAddress': targetAddress },
                        { type: BLOCK_TYPES.VALIDATOR_REGISTRATION, 'payload.validatorAddress': targetAddress }
                    ]
                };
                const activeStakes = await this.node.ledger.collection.find(stakeQuery).toArray();
                stakes = activeStakes.map((b: any) => ({
                    hash: b.hash,
                    index: b.metadata?.index,
                    type: b.type,
                    amount: b.payload.collateralAmount || b.payload.stakeAmount,
                    timestamp: b.metadata.timestamp
                }));
            }

            res.json({
                success: true,
                balance,
                emissionRate,
                transactions,
                stakes,
                totalPages,
                currentPage: page
            });
        } catch (error: any) {
            console.error('[API Error] /api/wallet:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
