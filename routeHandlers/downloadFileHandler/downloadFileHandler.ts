import { Request, Response } from 'express';
import { verifySignature, decryptPrivatePayload, createAESDecryptStream } from '../../cryptoUtils';

import logger from '../../logger';

import { Parse, Entry } from 'unzipper';
import { EncryptedBlockPrivate } from '../../types';

import BaseHandler from '../baseHandler';

export default class DownloadFileHandler extends BaseHandler {
    async handle(req: Request, res: Response) {
        let { hash, filename } = req.params;

        if (Array.isArray(filename)) {
            filename = filename[0];
        }
        const targetFileName = decodeURIComponent(filename);

        try {
            const privateKey = this.node.privateKey;

            // Find block by hash
            const blocks = await this.node.ledger.collection!.find({ hash: hash }).toArray();
            if (blocks.length === 0) {
                return res.status(404).send('Block not found.');
            }
            const block = blocks[0];

            // Verify signature
            const isSignatureValid = verifySignature(JSON.stringify(block.private), block.signature, block.publicKey);
            if (!isSignatureValid) {
                return res.status(401).send('Invalid block signature.');
            }

            // Decrypt private payload
            let privatePayload;
            try {
                privatePayload = decryptPrivatePayload(privateKey, block.private as EncryptedBlockPrivate);
            } catch (e) {
                return res.status(401).send('Failed to decrypt private payload.');
            }

            const readStreamResult = await this.node.storageProvider!.getBlockReadStream(privatePayload.physicalId);
            if (readStreamResult.status === 'not_found') {
                return res.status(404).send('Block not found.');
            }
            if (readStreamResult.status === 'pending') {
                return res.status(202).send(readStreamResult.message || 'Retrieval initiated. Please check back later.');
            }

            if (req.query?.statusOnly === 'true') {
                 if (typeof (readStreamResult.stream as any)?.destroy === 'function') {
                     (readStreamResult.stream as any).destroy();
                 }
                 return res.status(200).send('Available');
            }

            const readStream = readStreamResult.stream;

            const decipher = createAESDecryptStream(privatePayload.key, privatePayload.iv, privatePayload.authTag);

            readStream.on('error', (err: any) => {
                logger.error('[downloadFileHandler] ReadStream Error:', err);
                if (!res.headersSent) res.status(500).send('Error reading block.');
            });

            decipher.on('error', (err: any) => {
                logger.error('[downloadFileHandler] Decipher Error:', err);
                if (!res.headersSent) res.status(500).send('Decryption failed.');
            });

            // We will set headers ONLY when we find the file
            let found = false;

            const normalizedTarget = targetFileName.replace(/^\/+/, '');

            // Pipe storage -> decrypt -> unzip -> response
            readStream.pipe(decipher).pipe(Parse())
                .on('entry', function (entry: Entry) {
                    const normalizedEntry = entry.path.replace(/^\/+/, '');

                    // Archiver typically strips leading slashes, so using the normalized paths ensures
                    // files uploaded with absolute paths can still be accurately matched.
                    if (entry.path === targetFileName || normalizedEntry === normalizedTarget) {
                        found = true;

                        res.setHeader('Content-disposition', `attachment; filename="${targetFileName.split('/').pop()}"`);
                        res.setHeader('Content-type', 'application/octet-stream');

                        entry.pipe(res);
                    } else {
                        entry.autodrain();
                    }
                })
                .on('close', () => {
                    if (!found) {
                        if (!res.headersSent) {
                            res.status(404).send('File not found in block.');
                        } else {
                            res.end();
                        }
                    }
                })
                .on('error', (err: any) => {
                    logger.error('[downloadFileHandler] Unzip Error:', err);
                    if (!res.headersSent) res.status(500).send('Extraction failed.');
                });

        } catch (error) {
            logger.error(error as Error);
            if (!res.headersSent) {
                res.status(500).send('Server Error Processing Request');
            }
        }
    }
}
