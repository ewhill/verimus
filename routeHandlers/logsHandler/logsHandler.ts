import { Request, Response } from 'express';

import logger from '../../logger';


import BaseHandler from '../baseHandler';

export default class LogsHandler extends BaseHandler {
    async handle(req: Request, res: Response) {
    try {
        res.json(logger.getLogs());
    } catch (err: any) {
        logger.error(`[logsHandler] ${err.message}`);
        res.status(500).json({ success: false, message: err.message });
    }
    }
}
