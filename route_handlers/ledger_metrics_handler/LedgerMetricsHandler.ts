import { Request, Response } from 'express';

import BaseHandler from '../base_handler/BaseHandler';

export default class LedgerMetricsHandler extends BaseHandler {
    async handle(_unusedReq: Request, res: Response): Promise<void> {
        try {
            const latestBlock = await this.node.ledger.getLatestBlock();
            const currentIndex = latestBlock ? latestBlock.metadata.index : 0;
            
            // Hardcoded constant mapping exact engine prune triggers
            const epochSize = 1000000;

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

            res.json({
                success: true,
                currentIndex,
                epochSize,
                databaseFootprintBytes
            });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
