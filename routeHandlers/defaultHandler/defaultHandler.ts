import { Request, Response } from 'express';
import path from 'path';



import BaseHandler from '../baseHandler';

export default class DefaultHandler extends BaseHandler {
    async handle(req: Request, res: Response) {
    res.sendFile('index.html', { root: path.join(__dirname, '../../public') });
    }
}
