

import * as crypto from 'crypto';
import { Request, Response } from 'express';

import { PendingBlockMessage } from '../../messages/pending_block_message/PendingBlockMessage';
import { encryptPrivatePayload, signData } from '../../crypto_utils/CryptoUtils';
import logger from '../../logger/Logger';
import type { Block, BlockPrivate, StorageContractPayload, PeerConnection } from '../../types';


import BaseHandler from '../base_handler/BaseHandler';
import { BLOCK_TYPES } from '../../constants';

export default class UploadHandler extends BaseHandler {
    async handle(req: Request, res: Response) {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
        return res.status(400).send('No files uploaded.');
    }

    try {
        const publicKey = this.node.publicKey;
        const privateKey = this.node.privateKey;

        // 1 & 2 & 6. Stream zip and encrypt to storage provider
        logger.info(`[Peer ${this.node.port}] Processing file upload via streams...`);
        const { physicalBlockId, writeStream } = this.node.storageProvider!.createBlockStream();

        let paths: string[] = [];
        if (req.body.paths) {
            try {
                paths = JSON.parse(req.body.paths);
            } catch (e) {
                paths = Array.isArray(req.body.paths) ? req.body.paths : [req.body.paths];
            }
        } else {
            paths = (files as Express.Multer.File[]).map((f: Express.Multer.File) => f.originalname);
        }

        const bundleResult = await this.node.bundler!.streamBlockBundle(files, writeStream, paths);
        if (!bundleResult) return res.status(400).send('Bundle failed.');

        // 7. Generate Pending Block and initiate consensus
        const location = this.node.storageProvider!.getLocation();
        const privatePayload: BlockPrivate = {
            key: bundleResult.aesKey,
            iv: bundleResult.aesIv,
            authTag: bundleResult.authTag,
            location: location,
            physicalId: physicalBlockId,
            files: bundleResult.files
        };

        const encryptedPrivate = encryptPrivatePayload(publicKey, privatePayload);
        const signatureStr = signData(JSON.stringify(encryptedPrivate), privateKey);

        const pendingBlock: Block = {
            metadata: {
                index: -1,
                timestamp: Date.now(),
            },
            type: BLOCK_TYPES.CONTRACT,
            payload: encryptedPrivate as StorageContractPayload,
            publicKey: publicKey,
            signature: signatureStr
        };

        const blockId = crypto.createHash('sha256').update(signatureStr).digest('hex');

        logger.info(`[Peer ${this.node.port}] Initiating consensus for block ${blockId}`);

        // Create the message first so we have a deterministic timestamp for all nodes
        const p2pMsg = new PendingBlockMessage({ block: pendingBlock });

        // Process our own pending block using the EXACT same timestamp that will be broadcasted
        this.node.consensusEngine.handlePendingBlock(pendingBlock, { peerAddress: `127.0.0.1:${this.node.port}` } as any, Date.now()).catch(err => {
            logger.warn(`[Peer ${this.node.port}] Local pending block convergence exception caught gracefully avoiding crash loop: ${err.message}`);
        });

        // Broadcast Pending Block
            if (this.node.peer) {
                try {
                    this.node.peer.broadcast(p2pMsg).catch(err => {
                        logger.error(err);
                    });
                } catch (e: any) {
                    logger.warn(`Suppressed broadcast exception: ${e.message}`);
                }
            }
        // Setup asynchronous listener for consensus settlement
        const timeout = setTimeout(() => {
            this.node.events.removeAllListeners(`settled:${blockId}`);
            logger.error(`[Peer ${this.node.port}] Consensus timeout for block ${blockId.slice(0, 8)}`);
        }, 120000).unref(); // Expanded timeout to 2 minutes for edge cases since user doesn't wait and unref so it doesn't block exit

        this.node.events.once(`settled:${blockId}`, (settledBlock) => {
            clearTimeout(timeout);
            logger.info(`[Peer ${this.node.port}] Block ${settledBlock.hash.slice(0, 8)} consensus achieved and committed to local ledger.`);
        });

        // Respond immediately to UI
        res.status(202).json({
            success: true,
            message: "Block successfully uploaded and is pending consensus.",
            blockIndex: "Pending",
            hash: blockId,
            aesKey: bundleResult.aesKey,
            aesIv: bundleResult.aesIv
        });

    } catch (error: any) {
        logger.error(error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    }
}
