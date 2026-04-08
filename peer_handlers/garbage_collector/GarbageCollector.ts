import logger from '../../logger/Logger';
import PeerNode from '../../peer_node/PeerNode';
import { Block, StorageContractPayload } from '../../types';

class GarbageCollector {
    private node: PeerNode;
    private running: boolean = false;

    constructor(node: PeerNode) {
        this.node = node;
        this.node.ledger.events.on('blockAdded', async (block: Block) => {
            await this.processEpochTick(block.metadata.index);
        });
    }

    private async processEpochTick(currentIndex: number) {
        // Prevent concurrent re-entrance if disk IO takes incredibly long
        if (this.running) return;
        this.running = true;

        try {
            const expiredBlocks = await this.node.ledger.getExpiredContracts(currentIndex);

            for (const contractBlock of expiredBlocks) {
                const payload = contractBlock.payload as unknown as StorageContractPayload;
                if (!payload || !payload.fragmentMap) continue;

                // Identify if our active node matches a host assigned physical identities
                for (const fragment of payload.fragmentMap) {
                    if (fragment.nodeId === this.node.walletAddress && fragment.physicalId) {
                        logger.info(`[GarbageCollector ${this.node.port}] Node identified as host for expired contract ${contractBlock.hash}. Evicting physically...`);
                        
                        // Fire and forget physical disk shredding to preserve the global loop
                        this.node.storageProvider?.deleteBlock(fragment.physicalId).catch((err: any) => {
                            logger.warn(`[GarbageCollector ${this.node.port}] Unlink physical execution suppressed safely: ${err.message}`);
                        });
                    }
                }
            }
        } catch (err: any) {
            logger.error(`[GarbageCollector] Failed epoch prune evaluation cycle smoothly: ${err.message}`);
        } finally {
            this.running = false;
        }
    }
}

export default GarbageCollector;
