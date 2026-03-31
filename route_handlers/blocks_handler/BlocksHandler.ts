import { Request, Response } from 'express';
import { Filter } from 'mongodb';

import { BLOCK_TYPES } from '../../constants';
import { decryptPrivatePayload } from '../../crypto_utils/CryptoUtils';
import logger from '../../logger/Logger';
import type { Block, StorageContractPayload } from '../../types';
import BaseHandler from '../base_handler/BaseHandler';

export default class BlocksHandler extends BaseHandler {
    async handle(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const skip = (page - 1) * limit;
            const sortOrder = req.query.sort === 'asc' ? 1 : -1;

            const query: Filter<Block> = { "metadata.index": { $gt: 0 } };
            if (req.query.own === 'true') {
                query.publicKey = this.node.publicKey;
            }

            const searchQuery = req.query.q ? (req.query.q as string).toLowerCase() : null;

            // Fetch all matching blocks to memory so we can decrypt and filter
            let blocks = await this.node.ledger.collection!.find(query)
                .sort({ "metadata.index": sortOrder })
                .toArray();

            // Prepend pending blocks 
            let pendingBlocks: Block[] = [];
            if (this.node.mempool && this.node.mempool.pendingBlocks) {
                for (const [bId, entry] of this.node.mempool.pendingBlocks.entries()) {
                    if (!entry.committed) {
                        if (req.query.own === 'true' && entry.block.publicKey !== this.node.publicKey) continue;

                        pendingBlocks.push({
                            hash: bId,
                            metadata: {
                                index: -1,
                                timestamp: entry.originalTimestamp || Date.now(),
                            },
                            type: entry.block.type || BLOCK_TYPES.STORAGE_CONTRACT,
                            payload: entry.block.payload,
                            publicKey: entry.block.publicKey,
                            signature: entry.block.signature,
                        } as Block);
                    }
                }
                if (sortOrder === 1) {
                    pendingBlocks.sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);
                } else {
                    pendingBlocks.sort((a, b) => b.metadata.timestamp - a.metadata.timestamp);
                }
            }

            let combinedBlocks = sortOrder === 1 ? [...blocks, ...pendingBlocks] : [...pendingBlocks, ...blocks];

            // Decrypt file names and filter based on 'q' parameter
            if (searchQuery) {
                const privateKey = this.node.privateKey;
                const filteredBlocks: Block[] = [];

                for (const block of combinedBlocks) {
                    try {
                        // Access the original block data to get the true private payload for decryption
                        // since combinedBlocks has mapped values, we pull the payload from the raw source
                        let targetBlock: Block | undefined = blocks.find((b: Block) => b.hash === block.hash) as Block;
                        if (!targetBlock) targetBlock = pendingBlocks.find((b: Block) => b.hash === block.hash);

                        if (targetBlock && targetBlock.payload) {
                            const decodedObj = decryptPrivatePayload(privateKey, targetBlock.payload as StorageContractPayload);
                            if (decodedObj && decodedObj.files) {
                                const matchFound = decodedObj.files.some((file: { path: string }) =>
                                    file.path && file.path.toLowerCase().includes(searchQuery)
                                );
                                if (matchFound) {
                                    filteredBlocks.push(block);
                                }
                            }
                        }
                    } catch (err: any) {
                        logger.error(`[blocksHandler] Failed to decrypt block payload for search filter: ${err.message}`);
                    }
                }
                combinedBlocks = filteredBlocks;
            }

            const totalFiltered = combinedBlocks.length;
            const offsetBlocks = combinedBlocks.slice(skip, skip + limit);

            res.json({
                success: true,
                blocks: offsetBlocks,
                pagination: {
                    total: totalFiltered,
                    page,
                    limit,
                    pages: Math.ceil(totalFiltered / limit)
                }
            });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
