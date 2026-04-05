import { Request, Response } from 'express';

// Web3 Explicit Decoupling hook
import logger from '../../logger/Logger';
import type { StorageContractPayload, Block } from '../../types';
import BaseHandler from '../base_handler/BaseHandler';

export default class FilesHandler extends BaseHandler {
    async handle(_unusedReq: Request, res: Response) {
        try {
            const ownedHashes = this.node.ownedBlocksCache || [];

            let pendingBlocks: Block[] = [];
            if (this.node.mempool && this.node.mempool.pendingBlocks) {
                for (const [_unusedBId, entry] of this.node.mempool.pendingBlocks.entries()) {
                    if (!entry.committed && entry.block.signerAddress === this.node.walletAddress) {
                        pendingBlocks.push(entry.block);
                    }
                }
            }

            if (ownedHashes.length === 0 && pendingBlocks.length === 0) {
                return res.json({ success: true, files: [] });
            }

            // Fetch those blocks
            const blocks = ownedHashes.length > 0 ? await this.node.ledger.collection!.find({ hash: { $in: ownedHashes } }).toArray() : [];
            const allBlocks = [...blocks, ...pendingBlocks];
            const filesMap = new Map<string, FilesMapEntry>(); // key: "location::name" value: array of versions

            for (const block of allBlocks) {
                try {
                    if (block.payload) {
                        let decodedObj;
                        try {
                            const storagePayload = block.payload as StorageContractPayload;
                            decodedObj = JSON.parse(Buffer.from(storagePayload.encryptedPayloadBase64, 'base64').toString('utf8'));
                        } catch(_unusedE) { }
                        if (decodedObj && decodedObj.files) {
                            for (const file of decodedObj.files) {
                                if (file.path) {
                                    // Extract the underlying location object mapped by the upload bundler
                                    const locationInfo = decodedObj.location || { type: "unknown" };
                                    const locationLabel = locationInfo.type === 'samba' ? locationInfo.share
                                        : locationInfo.type === 'remote-fs' ? `${locationInfo.host}:${locationInfo.dir}`
                                            : locationInfo.type === 's3' ? `s3://${locationInfo.bucket}`
                                                : locationInfo.type === 'local' ? `local:${locationInfo.storageDir}`
                                                    : locationInfo.type === 'glacier' ? `glacier://${locationInfo.vault}`
                                                        : "Unknown any";

                                    const locationObj = {
                                        id: Buffer.from(JSON.stringify(locationInfo)).toString('base64'),
                                        type: locationInfo.type || 'unknown',
                                        label: locationLabel,
                                        raw: locationInfo
                                    };

                                    const key = `${locationObj.id}::${file.path}`;

                                    const versionData: VersionData = {
                                        hash: file.contentHash || file.hash, // Prefer contentHash from bundler over implicit hash
                                        blockHash: block.hash,
                                        timestamp: block.metadata ? block.metadata.timestamp : Date.now(),
                                        index: block.metadata && block.metadata.index !== undefined ? block.metadata.index : 'Pending',
                                        size: file.size || null,
                                        fragmentMap: (block.payload as any).fragmentMap || []
                                    };

                                    if (!filesMap.has(key)) {
                                        filesMap.set(key, {
                                            path: file.path,
                                            location: locationObj,
                                            versions: [versionData]
                                        });
                                    } else {
                                        filesMap.get(key)!.versions.push(versionData);
                                    }
                                }
                            }
                        }
                    }
                } catch (err: any) {
                    logger.error(`[filesHandler] Failed to decrypt block ${block.hash}: ${err.message}`);
                }
            }

            const results = Array.from(filesMap.values());
            results.forEach(fileData => {
                fileData.versions.sort((a: VersionData, b: VersionData) => b.timestamp - a.timestamp);
            });

            res.json({
                success: true,
                files: results
            });

        } catch (error: any) {
            logger.error(`[filesHandler] ${error.message}`);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

interface FilesMapEntry {
    path: string,
    location: {
        id: string,
        type: string,
        label: string,
        raw: any
    },
    versions: VersionData[],
}

interface VersionData {
    hash?: string,
    blockHash?: string,
    timestamp: number,
    index: string | number,
    size?: number,
    fragmentMap?: any[]
}
