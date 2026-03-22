import { Request, Response } from 'express';



import BaseHandler from '../base_handler/BaseHandler';

export default class NodeConfigHandler extends BaseHandler {
    async handle(req: Request, res: Response) {
    res.json({
        success: true,
        publicKey: this.node.publicKey,
        signature: this.node.signature,
        port: this.node.port
    });
    }
}
