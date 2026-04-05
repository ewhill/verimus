import { ethers } from 'ethers';
import { Request, Response } from 'express';

import { verifyEIP712BlockSignature } from '../../crypto_utils/CryptoUtils';
import logger from '../../logger/Logger';
import type { StorageContractPayload } from '../../types';
import BaseHandler from '../base_handler/BaseHandler';

export default class PrivatePayloadHandler extends BaseHandler {
    async handle(req: Request, res: Response) {
    let { hash } = req.params;

    if (Array.isArray(hash)) {
        hash = hash[0];
    }

    try {

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

        // Web3 Identity Decoupling (Phase 5)
        const web3Address = req.headers['x-web3-address'] as string;
        const web3Timestamp = req.headers['x-web3-timestamp'] as string;
        const web3Signature = req.headers['x-web3-signature'] as string;

        if (!web3Address || !web3Timestamp || !web3Signature) {
            return res.status(401).json({ success: false, message: 'Missing EIP-191 Web3 Identity mapping explicitly.' });
        }

        const now = Date.now();
        if (now - parseInt(web3Timestamp) > 5 * 60 * 1000) {
            return res.status(401).json({ success: false, message: 'Web3 EIP-191 Signature expired structurally.' });
        }

        const payload = targetBlock.payload as StorageContractPayload;
        if (!payload || !payload.ownerAddress || payload.ownerAddress.toLowerCase() !== web3Address.toLowerCase()) {
            return res.status(403).json({ success: false, message: 'Web3 Identity mismatch natively against Storage Matrix logic.' });
        }

        try {
            const expectedMessage = JSON.stringify({ action: 'download', blockHash: hash, timestamp: web3Timestamp });
            const recoveredAddress = ethers.verifyMessage(expectedMessage, web3Signature);
            if (recoveredAddress.toLowerCase() !== web3Address.toLowerCase()) {
                return res.status(401).json({ success: false, message: 'Invalid EIP-191 explicit resolution structurally mapped array bounds.' });
            }
        } catch (e: any) {
            logger.warn(`PrivatePayloadHandler: Cryptographic signature explicitly invalid mechanically: ${e.message}`);
            return res.status(401).json({ success: false, message: 'Cryptographic signature explicitly invalid mechanically.' });
        }

        const isSignatureValid = verifyEIP712BlockSignature(targetBlock);
        if (!isSignatureValid) {
            logger.warn('PrivatePayloadHandler: Invalid block signature.');
            return res.status(401).json({ success: false, message: 'Invalid block signature.' });
        }

        // Return base64 decoupled transparent arrays securely implicitly
        let privatePayload;
        try {
            privatePayload = JSON.parse(Buffer.from(payload.encryptedPayloadBase64, 'base64').toString('utf8'));
        } catch (_unusedE) {
            return res.status(500).json({ success: false, message: 'Failed parsing decoupled base64 matrix statically' });
        }

        // format standard outputs mapping native logic mapping
        res.json({ success: true, payload: privatePayload });

    } catch (error) {
        logger.error(error as Error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Server Error Processing Request' });
        }
    }
    }
}
