import { Request, Response } from 'express';



import BaseHandler from '../baseHandler';

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
