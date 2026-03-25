import path from 'path';

import { Request, Response } from 'express';



import BaseHandler from '../base_handler/BaseHandler';

export default class DefaultHandler extends BaseHandler {
    async handle(req: Request, res: Response) {
    res.sendFile('index.html', { root: path.join(__dirname, '../../public') });
    }
}
