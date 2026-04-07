import { Request, Response } from 'express';

import BaseHandler from '../base_handler/BaseHandler';

export default class ContractsHandler extends BaseHandler {
    async handle(req: Request, res: Response) {
        try {
            if (!this.node.ledger.activeContractsCollection) {
                return res.status(503).json({ success: false, message: 'Ledger database mappings not structurally initialized.' });
            }

            const page = parseInt((req.query.page as string) || '1', 10);
            const limit = parseInt((req.query.limit as string) || '10', 10);
            const skip = Math.max(0, (page - 1) * limit);

            const total = await this.node.ledger.activeContractsCollection.countDocuments({});
            const activeContracts = await this.node.ledger.activeContractsCollection.find({}).skip(skip).limit(limit).toArray();

            // Transform mappings to emphasize node allocation visually via the structural bounds
            const formattedContracts = activeContracts.map(doc => {
                const isLocalHost = doc.payload?.fragmentMap?.some((f: any) => f.nodeId === this.node.walletAddress) || false;

                return {
                    contractId: doc.contractId,
                    originator: doc.signerAddress,
                    payload: doc.payload,
                    isLocalHost
                };
            });

            return res.status(200).json({
                success: true,
                contracts: {
                    data: formattedContracts,
                    total
                }
            });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: `Failed to resolve contract endpoints: ${error.message}` });
        }
    }
}
