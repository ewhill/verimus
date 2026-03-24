import { Request, Response } from 'express';
import { Transform } from 'stream';
import { verifySignature, decryptPrivatePayload, createAESDecryptStream } from '../../crypto_utils/CryptoUtils';

import logger from '../../logger/Logger';

import { Parse, Entry } from 'unzipper';
import type { StorageContractPayload } from '../../types';

import { NodeRole } from '../../types/NodeRole';
import BaseHandler from '../base_handler/BaseHandler';

export default class DownloadFileHandler extends BaseHandler {
    async handle(req: Request, res: Response) {
        if (!this.node.roles.includes(NodeRole.STORAGE)) {
            return res.status(403).send('Forbidden: Node lacks STORAGE parameter.');
        }

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
            const isSignatureValid = verifySignature(JSON.stringify(block.payload), block.signature, block.publicKey);
            if (!isSignatureValid) {
                return res.status(401).send('Invalid block signature.');
            }

            // Decrypt private payload
            let privatePayload;
            try {
                privatePayload = decryptPrivatePayload(privateKey, block.payload as StorageContractPayload);
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

            const egressCostPerGB = (typeof this.node.storageProvider?.getEgressCostPerGB === 'function')
                ? this.node.storageProvider.getEgressCostPerGB()
                : 0;
            let accumulatedCost = 0;
            const maxEscrow = privatePayload.remainingEgressEscrow ?? privatePayload.allocatedEgressEscrow ?? 0;

            const byteSpooler = new Transform({
                transform(chunk, encoding, callback) {
                    if (egressCostPerGB > 0) {
                        const iterationCost = (chunk.length / (1024 * 1024 * 1024)) * egressCostPerGB;
                        accumulatedCost += iterationCost;

                        if (accumulatedCost > maxEscrow) {
                            return callback(new Error('Bandwidth escrow exhausted. Payment Required.'));
                        }
                    }
                    callback(null, chunk);
                }
            });

            readStream.on('error', (err: any) => {
                logger.error('[downloadFileHandler] ReadStream Error:', err);
                if (!res.headersSent) res.status(500).send('Error reading block.');
            });

            decipher.on('error', (err: any) => {
                logger.error('[downloadFileHandler] Decipher Error:', err);
                if (!res.headersSent) res.status(500).send('Decryption failed.');
            });

            byteSpooler.on('error', (err: any) => {
                logger.warn(`Egress cutoff triggered: ${err.message}`);
                if (!res.headersSent) res.status(402).send(err.message);
                else res.end();
                
                if (typeof (readStream as any).destroy === 'function') {
                    (readStream as any).destroy();
                }
            });

            res.on('close', async () => {
                if (accumulatedCost > 0) {
                    const resolvedHash = Array.isArray(hash) ? hash[0] : hash;
                    await this.node.consensusEngine?.walletManager?.deductEgressEscrow(resolvedHash, accumulatedCost);
                }
            });

            // We will set headers ONLY when we find the file
            let found = false;

            const normalizedTarget = targetFileName.replace(/^\/+/, '');

            // Pipe storage -> bill tracking -> decrypt -> unzip -> response
            readStream.pipe(byteSpooler).pipe(decipher).pipe(Parse())
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
