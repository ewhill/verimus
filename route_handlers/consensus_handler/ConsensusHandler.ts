import { Request, Response } from 'express';

import BaseHandler from '../base_handler/BaseHandler';

export default class ConsensusHandler extends BaseHandler {
    async handle(req: Request, res: Response) {
        try {
            if (!this.node.consensusEngine || !this.node.consensusEngine.mempool) {
                return res.status(503).json({ success: false, message: 'Consensus engine not initialized on this node.' });
            }

            const mempool = this.node.consensusEngine.mempool;

            const pendingPage = parseInt((req.query.pendingPage as string) || '1', 10);
            const forksPage = parseInt((req.query.forksPage as string) || '1', 10);
            const settledPage = parseInt((req.query.settledPage as string) || '1', 10);
            const limit = parseInt((req.query.limit as string) || '10', 10);

            const paginateMap = (map: Map<any, any>, page: number, limit: number, mapper: (k: any, v: any) => any) => {
                const result = [];
                const startIdx = (page - 1) * limit;
                const endIdx = page * limit;
                let idx = 0;

                for (const [key, value] of map.entries()) {
                    if (idx >= startIdx && idx < endIdx) {
                        result.push(mapper(key, value));
                    }
                    idx++;
                    if (idx >= endIdx) break; // Terminate iterator physically
                }

                return {
                    data: result,
                    total: map.size
                };
            };

            const pendingBlocks = paginateMap(mempool.pendingBlocks, pendingPage, 100, (hash, entry) => ({
                hash,
                type: entry.block.type,
                timestamp: entry.originalTimestamp,
                signerAddress: entry.block.signerAddress,
                eligible: entry.eligible || false,
                committed: entry.committed || false,
                verificationsCount: entry.verifications.size
            }));

            const eligibleForks = paginateMap(mempool.eligibleForks, forksPage, limit, (forkId, entry) => ({
                forkId,
                blockCount: entry.blockIds.length,
                proposalsCount: entry.proposals.size,
                adopted: entry.adopted || false
            }));

            const settledForks = paginateMap(mempool.settledForks, settledPage, limit, (forkId, entry) => ({
                forkId,
                finalTipHash: entry.finalTipHash,
                adoptionsCount: entry.adoptions.size,
                pendingCommit: entry.pendingCommit || false,
                committed: entry.committed || false
            }));

            return res.status(200).json({
                success: true,
                mempool: {
                    pendingBlocks,
                    eligibleForks,
                    settledForks
                }
            });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: `Failed to synthesize mempool bounds: ${error.message}` });
        }
    }
}
