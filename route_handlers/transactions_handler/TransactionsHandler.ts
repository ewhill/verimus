import crypto from 'crypto';

import { ethers } from 'ethers';
import { Request, Response } from 'express';

import { BLOCK_TYPES } from '../../constants';
import { EIP712_DOMAIN, EIP712_SCHEMAS, normalizeBlockForSignature } from '../../crypto_utils/EIP712Types';
import logger from '../../logger/Logger';
import type { Block, TransactionPayload } from '../../types';
import BaseHandler from '../base_handler/BaseHandler';

export default class TransactionsHandler extends BaseHandler {
    async handle(req: Request, res: Response) {
        try {
            const { action, recipientAddress, amount, ownerAddress, ownerSignature, timestamp } = req.body;

            if (action !== 'transfer') {
                return res.status(400).send('Invalid action for natively handling transfer payloads.');
            }

            if (!recipientAddress || !amount || !ownerAddress || !ownerSignature || !timestamp) {
                return res.status(400).send('Missing payload structural requirement limits natively.');
            }

            const proxyMessage = `Authorize decentralized transfer mapping\nTimestamp: ${timestamp}\nRecipient: ${recipientAddress}\nAmount: ${amount}`;
            let recoveredAddress: string;
            try {
                recoveredAddress = ethers.verifyMessage(proxyMessage, ownerSignature);
                if (recoveredAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
                    throw new Error("Mismatch strictly bypassing EIP-191 structural bounds.");
                }
            } catch (err: any) {
                return res.status(401).send(`Cryptography Check Rejected: Asymmetric Mismatch bounds natively failing EIP-191 payload. Details: ${err.message}`);
            }

            const parsedAmount = ethers.parseUnits(amount.toString(), 18);
            const currentBalance = await this.node.consensusEngine.walletManager.calculateBalance(recoveredAddress);

            if (currentBalance < parsedAmount) {
                return res.status(402).send('Insufficient structural native volume capacity for strictly mapping limit targets!');
            }

            const payload: TransactionPayload = {
                senderSignature: 'DEPRECATED_PROXY_MODEL_BOUNDS',
                senderAddress: recoveredAddress,
                recipientAddress: ethers.getAddress(recipientAddress),
                amount: parsedAmount
            };

            const tempBlock: Block = {
                type: BLOCK_TYPES.TRANSACTION,
                payload,
                signerAddress: this.node.walletAddress,
                signature: '',
                metadata: {
                    index: -1,
                    timestamp: Date.now()
                }
            };
            
            const valueObj = normalizeBlockForSignature(tempBlock);
            const schema = EIP712_SCHEMAS[BLOCK_TYPES.TRANSACTION];
            tempBlock.signature = await this.node.wallet.signTypedData(EIP712_DOMAIN, schema, valueObj.payload ? valueObj : valueObj);
            
            const strToHash = JSON.stringify(tempBlock, (_, v) => typeof v === 'bigint' ? v.toString() : v);
            tempBlock.hash = crypto.createHash('sha256').update(strToHash).digest('hex');
            
            const block = tempBlock;

            logger.info(`[Peer ${this.node.port}] Constructing natively injected target TRANSACTION proxy bounds.`);
            this.node.consensusEngine.handlePendingBlock(block, { peerAddress: 'api-proxy' } as any, Date.now()).catch(err => {
                logger.error(`Failed handling structurally mapping block via Proxy endpoint: ${err.message}`);
            });

            return res.status(200).json({ success: true, message: 'Transaction submitted autonomously!', blockHash: block.hash });
        } catch (err: any) {
            logger.error(`[API] Transaction injection payload explicitly failing natively: ${err.message}`);
            return res.status(500).json({ success: false, message: 'API Injection fault mathematically dynamically resolving constraints natively.' });
        }
    }
}
