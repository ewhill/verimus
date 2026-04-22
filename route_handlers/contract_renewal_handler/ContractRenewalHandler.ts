import * as crypto from 'crypto';

import { ethers } from 'ethers';
import { Request, Response } from 'express';

import { AVERAGE_BLOCK_TIME_MS, BLOCK_TYPES } from '../../constants';
import { EIP712_DOMAIN, EIP712_SCHEMAS, normalizeBlockForSignature } from '../../crypto_utils/EIP712Types';
import logger from '../../logger/Logger';
import { PendingBlockMessage } from '../../messages/pending_block_message/PendingBlockMessage';
import type { Block, ContractRenewalPayload, PeerConnection } from '../../types';
import BaseHandler from '../base_handler/BaseHandler';

export default class ContractRenewalHandler extends BaseHandler {
    async handle(req: Request, res: Response) {
        try {
            const marketId = req.params.marketId as string;
            const additionalTimelineDays = parseInt((req.body.additionalTimelineDays as string) || '0', 10);
            const additionalEscrowWei = req.body.additionalEscrow ? ethers.parseUnits(req.body.additionalEscrow.toString(), 18) : 0n;

            if (!marketId) {
                return res.status(400).json({ success: false, message: 'Missing marketId natively.' });
            }

            if (additionalTimelineDays <= 0 && additionalEscrowWei <= 0n) {
                return res.status(400).json({ success: false, message: 'Must provide either additional timeline days or additional escrow VERI.' });
            }

            if (!this.node.ledger.activeContractsCollection) {
                return res.status(503).json({ success: false, message: 'Ledger active contracts not structurally initialized.' });
            }

            const originalContract = await this.node.ledger.activeContractsCollection.findOne({ 'payload.marketId': marketId });
            if (!originalContract) {
                return res.status(404).json({ success: false, message: `Contract ${marketId} not formally mapped dynamically.` });
            }

            if (!this.node.wallet) {
                return res.status(503).json({ success: false, message: 'Local node wallet unavailable for signing natively.' });
            }

            if (originalContract.signerAddress !== this.node.walletAddress) {
                return res.status(403).json({ success: false, message: 'Only the original contract originator can geometrically renew it perfectly.' });
            }

            const targetDurationBlocks = Math.ceil((additionalTimelineDays * 24 * 3600 * 1000) / AVERAGE_BLOCK_TIME_MS);

            const payloadResult: ContractRenewalPayload = {
                marketId: marketId,
                additionalEscrow: additionalEscrowWei.toString(),
                additionalBlocks: targetDurationBlocks.toString()
            };

            const valBlock: Block = {
                metadata: {
                    index: -1,
                    timestamp: Date.now(),
                },
                type: BLOCK_TYPES.CONTRACT_RENEWAL,
                payload: payloadResult,
                signerAddress: this.node.walletAddress,
                previousHash: '',
                signature: ''
            };

            const valueObj = normalizeBlockForSignature(valBlock);
            const schema = EIP712_SCHEMAS[BLOCK_TYPES.CONTRACT_RENEWAL];
            
            valBlock.signature = await this.node.wallet.signTypedData(EIP712_DOMAIN, schema as any, valueObj.payload ? valueObj : valueObj);
            
            const pendingBlock = valBlock;
            const blockToHash = { ...pendingBlock };
            delete blockToHash.hash;
            // @ts-ignore
            delete (blockToHash as any)._id;
            const blockId = crypto.createHash('sha256').update(JSON.stringify(blockToHash)).digest('hex');

            logger.info(`[Peer ${this.node.port}] Initiating renewal consensus natively for contract ${marketId.slice(0, 8)}`);

            const p2pMsg = new PendingBlockMessage({ block: pendingBlock });
            const localConnection = { peerAddress: `127.0.0.1:${this.node.port}` } as unknown as PeerConnection;
            
            this.node.consensusEngine.handlePendingBlock(pendingBlock, localConnection, Date.now()).catch(err => {
                logger.warn(`[Peer ${this.node.port}] Local pending block convergence exception caught avoiding crash loop natively: ${err.message}`);
            });

            if (this.node.peer) {
                try {
                    this.node.peer.broadcast(p2pMsg).catch(err => logger.error(err));
                } catch (e: any) {
                    logger.warn(`Suppressed broadcast exception natively: ${e.message}`);
                }
            }

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    this.node.events.removeAllListeners(`settled:${blockId}`);
                    this.node.events.removeAllListeners(`failed:${blockId}`);
                    reject(new Error("Network timing constraint exceeded natively waiting for verifiable block quorum!"));
                }, 140000);

                this.node.events.once(`settled:${blockId}`, (settledBlock) => {
                    clearTimeout(timeout);
                    this.node.events.removeAllListeners(`failed:${blockId}`);
                    resolve(settledBlock);
                });

                this.node.events.once(`failed:${blockId}`, () => {
                    clearTimeout(timeout);
                    this.node.events.removeAllListeners(`settled:${blockId}`);
                    reject(new Error("P2P mesh definitively rejected renewal block natively!"));
                });
            });

            res.status(200).json({
                success: true,
                message: "Contract formally renewed successfully via quorum logically mapped.",
                hash: blockId
            });

        } catch (error: any) {
            logger.error(`[Contract Renewal] exception natively: ${error.message}`);
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: error.message });
            }
        }
    }
}
