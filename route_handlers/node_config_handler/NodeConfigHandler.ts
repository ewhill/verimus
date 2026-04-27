import { Request, Response } from 'express';



import BaseHandler from '../base_handler/BaseHandler';

export default class NodeConfigHandler extends BaseHandler {
    async handle(_unusedReq: Request, res: Response) {
        res.json({
            success: true,
            walletAddress: this.node.walletAddress,
            port: this.node.port,
            roles: this.node.roles,
            proxyBrokerFee: this.node.proxyBrokerFee,
            storageConfig: this.node.storageProvider ? {
                ...this.node.storageProvider.getLocation(),
                costPerGB: this.node.storageProvider.getCostPerGB(),
                egressCostPerGB: this.node.storageProvider.getEgressCostPerGB()
            } : null
        });
    }
}
