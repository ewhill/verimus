import { Request, Response } from 'express';

import { decryptPrivatePayload } from '../../cryptoUtils';
import logger from '../../logger';

import { EncryptedBlockPrivate, Block } from '../../types';

import BaseHandler from '../baseHandler';

export default class FilesHandler extends BaseHandler {
    async handle(req: Request, res: Response) {
    try {
        const ownedHashes = this.node.ownedBlocksCache || [];

        let pendingBlocks: Block[] = [];
        if (this.node.mempool && this.node.mempool.pendingBlocks) {
            for (const [bId, entry] of this.node.mempool.pendingBlocks.entries()) {
                if (!entry.committed && entry.block.publicKey === this.node.publicKey) {
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
        const privateKey = this.node.privateKey;
        const filesMap = new Map<string, FilesMapEntry>(); // key: "location::name" value: array of versions

        for (const block of allBlocks) {
            try {
                if (block.private) {
                    const decodedObj = decryptPrivatePayload(privateKey, block.private as EncryptedBlockPrivate);
                    if (decodedObj && decodedObj.files) {
                        for (const file of decodedObj.files) {
                            if (file.path) {
                                // Extract the underlying location object cleanly mapped by the upload bundler organically
                                const locationInfo = decodedObj.location || { type: "unknown" };
                                const locationLabel = locationInfo.type === 'samba' ? locationInfo.share
                                    : locationInfo.type === 'remote-fs' ? `${locationInfo.host}:${locationInfo.dir}`
                                        : locationInfo.type === 's3' ? `s3://${locationInfo.bucket}`
                                            : locationInfo.type === 'local' ? `local:${locationInfo.storageDir}`
                                                : locationInfo.type === 'glacier' ? `glacier://${locationInfo.vault}`
                                                    : "Unknown Location";

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
                                    size: file.size || null
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
        raw: Location
    },
    versions: VersionData[],
}

interface VersionData {
    hash?: string,
    blockHash?: string,
    timestamp: number,
    index: string | number,
    size?: number
}
