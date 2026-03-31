import { Request, Response } from 'express';

import { NodeRole } from '../../types/NodeRole';
import BaseHandler from '../base_handler/BaseHandler';

export default class UpdateNodeConfigHandler extends BaseHandler {
    async handle(req: Request, res: Response): Promise<void> {
        // SECURITY REQUIREMENT: Only allow modifications from localhost exclusively
        const ip = req.ip || req.socket.remoteAddress || '';
        if (ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1') {
            res.status(403).json({ success: false, message: 'Forbidden: Config mutation restricted to localhost exclusively.' });
            return;
        }

        const { roles, costPerGB, egressCostPerGB } = req.body;

        if (Array.isArray(roles)) {
            // Strictly assign arrays to ensure iteration logic sustains natively
            this.node.roles = roles as NodeRole[];
        }

        if (this.node.storageProvider) {
            if (typeof costPerGB === 'number' && !isNaN(costPerGB)) {
                this.node.storageProvider.setCostPerGB(costPerGB);
            }
            if (typeof egressCostPerGB === 'number' && !isNaN(egressCostPerGB)) {
                this.node.storageProvider.setEgressCostPerGB(egressCostPerGB);
            }
        }

        res.json({ success: true });
    }
}
