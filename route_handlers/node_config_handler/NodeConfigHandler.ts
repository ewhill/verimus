import { Request, Response } from 'express';



import BaseHandler from '../base_handler/BaseHandler';

export default class NodeConfigHandler extends BaseHandler {
    async handle(_unusedReq: Request, res: Response) {
        res.json({
            success: true,
            publicKey: this.node.publicKey,
            signature: this.node.signature,
            port: this.node.port,
            roles: this.node.roles,
            storageConfig: this.node.storageProvider ? {
                ...this.node.storageProvider.getLocation(),
                costPerGB: this.node.storageProvider.getCostPerGB(),
                egressCostPerGB: this.node.storageProvider.getEgressCostPerGB()
            } : null
        });
    }
}
