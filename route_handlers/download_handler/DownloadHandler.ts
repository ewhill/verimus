import { Request, Response } from 'express';

import { verifySignature, decryptPrivatePayload, createAESDecryptStream } from '../../crypto_utils/CryptoUtils';
import logger from '../../logger/Logger';

import { EncryptedBlockPrivate } from '../../types';

import BaseHandler from '../base_handler/BaseHandler';

export default class DownloadHandler extends BaseHandler {
    async handle(req: Request, res: Response) {
        const { hash } = req.params;

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

            res.setHeader('Content-disposition', `attachment; filename=block_${hash}.zip`);
            res.setHeader('Content-type', 'application/zip');

            readStream.on('error', (err: any) => {
                logger.error('ReadStream Error:', err);
                if (!res.headersSent) res.status(500).send('Error reading block.');
            });

            decipher.on('error', (err: any) => {
                logger.error('Decipher Error:', err);
                if (!res.headersSent) res.status(500).send('Decryption failed, check your keys.');
            });

            // Pipe storage -> decrypt -> response
            readStream.pipe(decipher).pipe(res);

        } catch (error) {
            logger.error(error as Error);
            if (!res.headersSent) {
                res.status(500).send('Server Error Processing Download');
            }
        }
    }
}
