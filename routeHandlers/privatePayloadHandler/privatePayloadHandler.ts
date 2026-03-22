import { Request, Response } from 'express';

import { verifySignature, decryptPrivatePayload } from '../../cryptoUtils';
import logger from '../../logger';

import { EncryptedBlockPrivate } from '../../types';

import BaseHandler from '../baseHandler';

export default class PrivatePayloadHandler extends BaseHandler {
    async handle(req: Request, res: Response) {
    let { hash } = req.params;

    if (Array.isArray(hash)) {
        hash = hash[0];
    }

    try {
        const privateKey = this.node.privateKey;

        // Find block by hash
        const blocks = await this.node.ledger.collection!.find({ hash: hash }).toArray();
        let targetBlock;
        if (blocks.length === 0) {
            // Check mempool
            if (this.node.mempool && this.node.mempool.pendingBlocks) {
                const mempoolEntry = this.node.mempool.pendingBlocks.get(hash);
                if (mempoolEntry) {
                    targetBlock = mempoolEntry.block;
                }
            }
        } else {
            targetBlock = blocks[0];
        }

        if (!targetBlock) {
            return res.status(404).json({ success: false, message: 'Block not found.' });
        }

        // Must be owned block (or at least valid signature under target public key)
        if (targetBlock.publicKey !== this.node.publicKey) {
            return res.status(403).json({ success: false, message: 'Not an owned block.' });
        }

        const isSignatureValid = verifySignature(JSON.stringify(targetBlock.private), targetBlock.signature, targetBlock.publicKey);
        if (!isSignatureValid) {
            return res.status(401).json({ success: false, message: 'Invalid block signature.' });
        }

        // Decrypt private payload
        let privatePayload;
        try {
            privatePayload = decryptPrivatePayload(privateKey, targetBlock.private as EncryptedBlockPrivate);
        } catch (e) {
            return res.status(401).json({ success: false, message: 'Failed to decrypt private payload.' });
        }

        // Explicitly format standard outputs mapping native logic mapping
        res.json({ success: true, payload: privatePayload });

    } catch (error) {
        logger.error(error as Error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Server Error Processing Request' });
        }
    }
    }
}
