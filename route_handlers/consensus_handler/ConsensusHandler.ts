import { Request, Response } from 'express';

import BaseHandler from '../base_handler/BaseHandler';

export default class ConsensusHandler extends BaseHandler {
    async handle(req: Request, res: Response) {
        try {
            if (!this.node.consensusEngine || !this.node.consensusEngine.mempool) {
                return res.status(503).json({ success: false, message: 'Consensus engine not initialized on this node.' });
            }

            const mempool = this.node.consensusEngine.mempool;

            // Serialize Pending Blocks (convert Map to Array, format safely)
            const pendingBlocks = Array.from(mempool.pendingBlocks.entries()).map(([hash, entry]) => ({
                hash,
                type: entry.block.type,
                timestamp: entry.originalTimestamp,
                signerAddress: entry.block.signerAddress,
                eligible: entry.eligible || false,
                committed: entry.committed || false,
                verificationsCount: entry.verifications.size
            }));

            // Serialize Eligible Forks
            const eligibleForks = Array.from(mempool.eligibleForks.entries()).map(([forkId, entry]) => ({
                forkId,
                blockCount: entry.blockIds.length,
                proposalsCount: entry.proposals.size,
                adopted: entry.adopted || false
            }));

            // Serialize Settled Forks
            const settledForks = Array.from(mempool.settledForks.entries()).map(([forkId, entry]) => ({
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
