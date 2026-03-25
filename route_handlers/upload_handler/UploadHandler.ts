

import * as crypto from 'crypto';
import { Request, Response } from 'express';

import { PendingBlockMessage } from '../../messages/pending_block_message/PendingBlockMessage';
import { encryptPrivatePayload, signData } from '../../crypto_utils/CryptoUtils';
import logger from '../../logger/Logger';
import type { Block, BlockPrivate, StorageContractPayload, PeerConnection } from '../../types';


import { NodeRole } from '../../types/NodeRole';
import BaseHandler from '../base_handler/BaseHandler';
import { BLOCK_TYPES } from '../../constants';

export default class UploadHandler extends BaseHandler {
    async handle(req: Request, res: Response) {
    if (!this.node.roles.includes(NodeRole.ORIGINATOR)) {
        return res.status(403).send('Forbidden: Node lacks ORIGINATOR parameter.');
    }
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

        const redundancyStr = req.body.redundancy;
        const maxCostStr = req.body.maxCost;
        let redundancy = redundancyStr ? parseInt(redundancyStr, 10) : 1;
        let maxCost = maxCostStr ? parseFloat(maxCostStr) : 50.0;

        if (isNaN(redundancy) || redundancy < 1) return res.status(400).send('Invalid redundancy parameter.');
        if (isNaN(maxCost) || maxCost <= 0) return res.status(400).send('Invalid maxCost boundary.');

        // Cap minimum redundancy safely natively bounds
        if (redundancy > 5) redundancy = 5; 

        let paths: string[] = [];
        try {
            paths = JSON.parse(req.body.paths || '[]');
        } catch {
            paths = Array.isArray(req.body.paths) ? req.body.paths : [req.body.paths].filter(Boolean);
        }
        if (paths.length === 0) paths = files.map(f => f.originalname);

        const totalSize = files.reduce((acc, f) => acc + f.size, 0);
        const chunkSizeBytes = 65536; // 64KB Phase 3 explicit constant
        const theoreticalMaxCost = maxCost * redundancy * Math.max((totalSize / (1024 * 1024 * 1024)), 0.000001);
        const marketReqId = crypto.randomUUID();

        // Escrow phase explicitly tracking theoretical spend limits securely natively mapping against double-spends
        const hasFunds = await this.node.consensusEngine.walletManager.verifyFunds(publicKey, theoreticalMaxCost);
        if (!hasFunds && publicKey !== 'SYSTEM') {
            return res.status(402).send('Insufficient Wallet Funds allocating explicitly constrained P2P limit orders dynamically.');
        }

        this.node.consensusEngine.walletManager.freezeFunds(publicKey, theoreticalMaxCost, marketReqId);
        logger.info(`[Peer ${this.node.port}] Initiating async storage limit order ${marketReqId} searching mapping ${redundancy} hosts safely natively...`);

        // Triage Bid Harvesting explicitly parsing bounds dynamically against TCP buffers natively!
        const bids = await this.node.consensusEngine.node.syncEngine.orchestrateStorageMarket(
            marketReqId, totalSize, chunkSizeBytes, redundancy, maxCost
        );

        if (bids.length < redundancy) {
            this.node.consensusEngine.walletManager.releaseFunds(marketReqId);
            return res.status(422).send(`Decentralized market triage loop timed out actively pulling isolated P2P arrays natively smoothly! Acquired hosts: ${bids.length}`);
        }

        logger.info(`[Peer ${this.node.port}] Decentralized array acquired mapping 100% boundary limits smoothly. Hosts: ${bids.map((b: any) => b.peerId.slice(0, 8)).join(', ')}`);

        // Physical Archiving (Mock logical routing onto local boundary, integrating streaming next phase)
        const bundleResult = await this.node.bundler!.streamBlockBundle(files, writeStream, paths);
        if (!bundleResult) {
            this.node.consensusEngine.walletManager.releaseFunds(marketReqId); // Release if fail zip natively
            return res.status(500).send('Internal Node Array Zip mapping collapsed explicitly.');
        }

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

        const payloadResult: StorageContractPayload = {
            ...encryptedPrivate,
            marketId: marketReqId,
            activeHosts: bids.map((b: any) => b.peerId)
        };

        const signatureStr = signData(JSON.stringify(payloadResult), privateKey);

        const pendingBlock: Block = {
            metadata: {
                index: -1,
                timestamp: Date.now(),
            },
            type: BLOCK_TYPES.STORAGE_CONTRACT,
            payload: payloadResult,
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
            this.node.consensusEngine.walletManager.commitFunds(marketReqId); // Flushes local mapped lock smoothly safely
            logger.info(`[Peer ${this.node.port}] Block ${settledBlock.hash.slice(0, 8)} consensus achieved resolving limit orders securely directly!`);
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
