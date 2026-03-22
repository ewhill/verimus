import { Request, Response, NextFunction } from 'express';
import PeerNode from '../../peer_node/PeerNode';

export default abstract class BaseHandler {
    protected node: PeerNode;

    constructor(node: PeerNode) {
        this.node = node;
        this.handle = this.handle.bind(this);
    }

    abstract handle(req: Request, res: Response, next?: NextFunction): Promise<any> | void;
}
