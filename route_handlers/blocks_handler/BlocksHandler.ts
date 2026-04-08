import { Request, Response } from 'express';


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

            const query: any = { "metadata.index": { $gt: 0 } };
            if (req.query.own === 'true') {
                if (req.query.address) {
                    query["payload.ownerAddress"] = { $regex: new RegExp(`^${req.query.address as string}$`, 'i') };
                } else {
                    query.signerAddress = this.node.walletAddress;
                }
            }

            if (req.query.type) {
                switch (req.query.type) {
                    case 'storage_contract':
                        query.type = BLOCK_TYPES.STORAGE_CONTRACT;
                        break;
                    case 'checkpoint':
                        query.type = BLOCK_TYPES.CHECKPOINT;
                        break;
                    case 'slashing_transaction':
                        query.type = BLOCK_TYPES.SLASHING_TRANSACTION;
                        break;
                    case 'staking_contract':
                        query.type = BLOCK_TYPES.STAKING_CONTRACT;
                        break;
                    case 'transaction':
                        query.type = BLOCK_TYPES.TRANSACTION;
                        break;
                    default:
                        throw new Error(`Invalid block type: ${req.query.type}`);
                }
            }

            const searchQuery = req.query.q ? (req.query.q as string).toLowerCase() : null;

            // Fetch all matching blocks to memory so we can decrypt and filter
            logger.info("MongoDB Query Triggered: " + JSON.stringify(query)); let blocks = await this.node.ledger.collection!.find(query)
                .sort({ "metadata.index": sortOrder })
                .toArray();

            // Prepend pending blocks 
            let pendingBlocks: Block[] = [];
            if (this.node.mempool && this.node.mempool.pendingBlocks) {
                for (const [bId, entry] of this.node.mempool.pendingBlocks.entries()) {
                    if (!entry.committed) {
                        try {
                            const duplicate = await this.node.ledger.collection!.findOne({ signature: entry.block.signature });
                            if (duplicate) {
                                entry.committed = true;
                                this.node.mempool.pendingBlocks.delete(bId);
                                continue;
                            }
                        } catch (_unusedErr) {
                            // Safe fallthrough
                        }

                        if (req.query.own === 'true') {
                            if (req.query.address) {
                                if (!entry.block.payload || (entry.block.payload as any).ownerAddress?.toLowerCase() !== (req.query.address as string).toLowerCase()) continue;
                            } else {
                                if (entry.block.signerAddress !== this.node.walletAddress) continue;
                            }
                        }
                        if (req.query.type && entry.block.type !== req.query.type) continue;

                        pendingBlocks.push({
                            hash: bId,
                            metadata: {
                                index: -1,
                                timestamp: entry.originalTimestamp || Date.now(),
                            },
                            type: entry.block.type || BLOCK_TYPES.STORAGE_CONTRACT,
                            payload: entry.block.payload,
                            signerAddress: entry.block.signerAddress,
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
                const privateKey = (this.node as any).wallet?.privateKey || 'MOCK_KEY';
                const filteredBlocks: Block[] = [];

                for (const block of combinedBlocks) {
                    // Check top-level block properties first
                    if (
                        (block.hash && block.hash.toLowerCase().includes(searchQuery)) ||
                        (block.signerAddress && block.signerAddress.toLowerCase().includes(searchQuery)) ||
                        (block.type && block.type.toLowerCase().includes(searchQuery)) ||
                        (block.payload && (block.payload as any).ownerAddress && (block.payload as any).ownerAddress.toLowerCase().includes(searchQuery))
                    ) {
                        filteredBlocks.push(block);
                        continue;
                    }

                    try {
                        // Access the original block data to get the true private payload for decryption
                        // since combinedBlocks has mapped values, we pull the payload from the raw source
                        let targetBlock: Block | undefined = blocks.find((b: Block) => b.hash === block.hash) as Block;
                        if (!targetBlock) targetBlock = pendingBlocks.find((b: Block) => b.hash === block.hash);

                        if (targetBlock && targetBlock.payload && (targetBlock.payload as StorageContractPayload).encryptedPayloadBase64) {
                            const decodedObj = decryptPrivatePayload(privateKey, targetBlock.payload as any);
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
