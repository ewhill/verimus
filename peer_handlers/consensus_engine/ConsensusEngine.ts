
import { AdoptForkMessage } from '../../messages/adopt_fork_message/AdoptForkMessage';
import { PendingBlockMessage } from '../../messages/pending_block_message/PendingBlockMessage';
import { ProposeForkMessage } from '../../messages/propose_fork_message/ProposeForkMessage';
import { VerifyBlockMessage } from '../../messages/verify_block_message/VerifyBlockMessage';
import PeerNode from '../../peer_node/PeerNode';
import type { PeerConnection, Block } from '../../types';
import BftCoordinator from '../bft_coordinator/BftCoordinator';
import GlobalAuditor from '../global_auditor/GlobalAuditor';
import MempoolManager from '../mempool_manager/MempoolManager';

class ConsensusEngine {
    node: PeerNode;
    
    mempoolManager: MempoolManager;
    bftCoordinator: BftCoordinator;
    globalAuditor: GlobalAuditor;

    constructor(peerNode: PeerNode) {
        this.node = peerNode;

        this.mempoolManager = new MempoolManager(peerNode);
        this.bftCoordinator = new BftCoordinator(peerNode);
        this.globalAuditor = new GlobalAuditor(peerNode);

        // Preemptively map internal bus structures immediately initializing pipelines for integrations seamlessly natively
        this.bftCoordinator.start();
        this.globalAuditor.start();
    }

    // Backwards Compatibility Proxies 
    get mempool() { return this.node.mempool; }
    get walletManager() { return this.node.walletManager; }
    get committing() { return this.bftCoordinator.committing; }

    async handlePendingBlock(block: Block, connection: PeerConnection, timestamp: number) {
        return this.mempoolManager.handlePendingBlock(block, connection, timestamp);
    }

    async handleAdoptFork(forkId: string, finalTipHash: string, connection: PeerConnection) {
        return this.bftCoordinator.handleAdoptFork(forkId, finalTipHash, connection);
    }

    async handleProposeFork(forkId: string, blockIds: string[], connection: PeerConnection) {
        return this.bftCoordinator.handleProposeFork(forkId, blockIds, connection);
    }

    async _checkAndProposeFork() {
        return this.bftCoordinator._checkAndProposeFork();
    }

    async handleVerifyBlock(blockId: string, signature: string, connection: PeerConnection) {
        return this.bftCoordinator.handleVerifyBlock(blockId, signature, connection);
    }

    async runGlobalAudit() {
        return this.globalAuditor.runGlobalAudit();
    }
    
    stop() {
        this.globalAuditor.stop();
        if (this.bftCoordinator['proposalTimeout']) clearTimeout(this.bftCoordinator['proposalTimeout']);
        for (const timeout of this.bftCoordinator['activeForkTimeouts'].values()) {
            clearTimeout(timeout);
        }
    }


    bindHandlers() {
        this.node.peer?.bind(PendingBlockMessage).to(async (m: PendingBlockMessage, c: PeerConnection) => {
            const timestamp = m.header?.timestamp ? new Date(m.header.timestamp).getTime() : Date.now();
            // @ts-ignore
            await this.mempoolManager.handlePendingBlock(m.block, c, timestamp);
        });
        
        this.node.peer?.bind(VerifyBlockMessage).to(async (m: VerifyBlockMessage, c: PeerConnection) => {
            await this.bftCoordinator.handleVerifyBlock(m.blockId, m.signature, c);
        });
        
        this.node.peer?.bind(ProposeForkMessage).to(async (m: ProposeForkMessage, c: PeerConnection) => {
            await this.bftCoordinator.handleProposeFork(m.forkId, m.blockIds, c);
        });
        
        this.node.peer?.bind(AdoptForkMessage).to(async (m: AdoptForkMessage, c: PeerConnection) => {
            await this.bftCoordinator.handleAdoptFork(m.forkId, m.finalTipHash, c);
        });
        
        // Listen to native internal BFT bounds explicitly routed from checkPoint loop structures
        this.node.events.on('NETWORK:INBOUND_PENDING_BLOCK', async (block: any) => {
             await this.mempoolManager.handlePendingBlock(block, { peerAddress: '127.0.0.1:0' } as any, Date.now());
        });

        // Map decoupled SyncEngine thresholds natively back towards the local memory routers
        this.node.events.on('SYNC_PHASE_COMPLETE', async (evt: any) => {
            if (evt.type === 'PendingBlock') {
                await this.mempoolManager.handlePendingBlock(evt.block!, evt.connection, evt.timestamp!);
            } else if (evt.type === 'AdoptFork') {
                await this.bftCoordinator.handleAdoptFork(evt.forkId!, evt.finalTipHash!, evt.connection);
            } else if (evt.type === 'ProposeFork') {
                await this.bftCoordinator.handleProposeFork(evt.forkId!, evt.blockIds!, evt.connection);
            }
        });
    }
}

export default ConsensusEngine;
