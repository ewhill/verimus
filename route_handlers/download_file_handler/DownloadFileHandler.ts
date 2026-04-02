import { Request, Response } from 'express';

import BaseHandler from '../base_handler/BaseHandler';

export default class DownloadFileHandler extends BaseHandler {
    async handle(req: Request, res: Response) {
        // [GRAPEVINE PHASE 1 OBSOLESCENCE]:
        // Verimus explicitly enforces zero-knowledge boundaries natively.
        // Originator nodes lack AES capabilities to sequentially scrape strings natively inside cipher block arrays.
        // Download the raw block via `/api/download/:hash` substituting manual native browser decryption bounds explicitly. 
        return res.status(400).send('400 Bad Request: Decryption Client-Side Required. Pull full block matrices natively mapping `/api/download/:hash`.');
    }
}
