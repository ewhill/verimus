import { Request, Response } from 'express';

import BaseHandler from '../base_handler/BaseHandler';

export default class ContractsHandler extends BaseHandler {
    async handle(req: Request, res: Response) {
        try {
            if (!this.node.ledger.activeContractsCollection) {
                return res.status(503).json({ success: false, message: 'Ledger database mappings not structurally initialized.' });
            }

            const activeContracts = await this.node.ledger.activeContractsCollection.find({}).toArray();

            // Transform mappings to emphasize node allocation visually via the structural bounds
            const formattedContracts = activeContracts.map(doc => {
                const isLocalHost = doc.payload?.fragmentMap?.some((f: any) => f.nodeId === this.node.walletAddress) || false;

                return {
                    contractId: doc.contractId,
                    originator: doc.signerAddress,
                    payload: doc.payload,
                    isLocalHost,
                    localActive: isLocalHost && req.query.own === 'true'
                };
            });

            const filteredContracts = req.query.own === 'true' 
                ? formattedContracts.filter(c => c.isLocalHost || c.originator === this.node.walletAddress)
                : formattedContracts;

            return res.status(200).json({
                success: true,
                contracts: filteredContracts
            });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: `Failed to resolve contract endpoints: ${error.message}` });
        }
    }
}
