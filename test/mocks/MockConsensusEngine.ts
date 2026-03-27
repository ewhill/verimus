import type PeerNode from '../../peer_node/PeerNode';
import WalletManager from '../../wallet_manager/WalletManager';

export class MockConsensusEngine {
    node: PeerNode;
    walletManager: WalletManager;

    constructor(node: PeerNode) {
        this.node = node;
        this.walletManager = new WalletManager(node.ledger);
    }

    bindHandlers(): void {}
}
