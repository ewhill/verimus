import type PeerNode from '../../peer_node/PeerNode';

export class MockSyncEngine {
    node: PeerNode;

    constructor(node: PeerNode) {
        this.node = node;
    }

    bindHandlers(): void {}
    async performInitialSync(): Promise<void> {}
}
