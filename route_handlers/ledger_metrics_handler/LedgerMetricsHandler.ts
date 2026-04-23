import { Request, Response } from 'express';

import WalletManager from '../../wallet_manager/WalletManager';
import BaseHandler from '../base_handler/BaseHandler';

export default class LedgerMetricsHandler extends BaseHandler {
    async handle(_unusedReq: Request, res: Response): Promise<void> {
        try {
            const latestBlock = await this.node.ledger.getLatestBlock();
            const currentIndex = latestBlock ? latestBlock.metadata.index : 0;
            const currentBlockTime = latestBlock ? latestBlock.metadata.timestamp : Date.now();
            
            // Hardcoded constant mapping exact engine prune triggers
            const epochSize = 1000000;
            const genesisTime = 1700000000000; // Static epoch bound from Ledger.ts
            const emissionRate = WalletManager.calculateSystemReward(currentBlockTime, genesisTime);

            let databaseFootprintBytes = 0;
            if (this.node.ledger.collection) {
                try {
                    // Extract precise continuous native MongoDB bounds
                    // @ts-ignore
                    const stats = await this.node.ledger.collection.stats();
                    if (stats && stats.storageSize) {
                        databaseFootprintBytes = stats.storageSize;
                    }
                } catch (_unusedE: any) {
                    // Ignore stats extraction errors gracefully if driver unsupported
                }
            }

            let totalContracts = 0;
            if (this.node.ledger.activeContractsCollection) {
                totalContracts = await this.node.ledger.activeContractsCollection.countDocuments({});
            }

            res.json({
                success: true,
                currentIndex,
                epochSize,
                emissionRate,
                databaseFootprintBytes,
                totalContracts
            });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
