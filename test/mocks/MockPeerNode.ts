import PeerNode from '../../peer_node/PeerNode';
import { NodeRole } from '../../types/NodeRole';

export class MockPeerNode {
    port: number;
    publicAddress: string | null;
    ledger: any;
    peer: any;
    storageProvider: any;
    bundler: any;
    mempool: any;
    reputationManager: any;
    consensusEngine: any;
    events: any;
    roles: NodeRole[];
    publicKey: string;
    privateKey: string;
    signature: string;
    ownedBlocksCache: string[];

    constructor(options: Partial<MockPeerNode> = {}) {
        this.port = options.port || 3000;
        this.publicAddress = options.publicAddress || '127.0.0.1:3000';
        
        this.ledger = options.ledger || {
            collection: {
                countDocuments: async () => 0,
                find: () => ({ toArray: async () => [] }),
                insertOne: async () => {}
            },
            ownedBlocksCollection: {
                countDocuments: async () => 0,
                find: () => ({ toArray: async () => [] }),
                insertOne: async () => {},
                deleteMany: async () => {}
            },
            peersCollection: {
                testMarker: true,
                find: () => ({ toArray: async () => [] }),
                findOne: async () => null,
                updateOne: async () => {}
            }
        };

        this.peer = options.peer || {
            trustedPeers: [],
            peers: [],
            wsServer: null,
            init: async () => {},
            discover: async () => {},
            close: async () => {}
        };

        this.mempool = options.mempool || {
            pendingBlocks: new Map()
        };

        this.reputationManager = options.reputationManager || {
            peersCollection: this.ledger.peersCollection,
            isBanned: async () => false,
            slash: async () => {},
            reward: async () => {},
            on: () => {}
        };
        
        this.consensusEngine = options.consensusEngine || null;
        this.events = options.events || null;

        this.storageProvider = options.storageProvider || null;
        this.bundler = options.bundler || null;
        this.roles = options.roles || [NodeRole.ORIGINATOR, NodeRole.VALIDATOR, NodeRole.STORAGE];
        this.publicKey = options.publicKey || 'MOCK_PUB_KEY';
        this.privateKey = options.privateKey || 'MOCK_PRIV_KEY';
        this.signature = options.signature || 'MOCK_SIGNATURE';
        this.ownedBlocksCache = options.ownedBlocksCache || [];
    }

    async addOwnedBlockToCache(block: any) {
        if (this.mempool.pendingBlocks.has(block.hash)) {
            this.mempool.pendingBlocks.delete(block.hash);
        }
        if (block.publicKey === this.publicKey && !this.ownedBlocksCache.includes(block.hash)) {
            this.ownedBlocksCache.push(block.hash);
        }
    }

    getMajorityCount() {
        const totalNodes = (this.peer && this.peer.trustedPeers ? this.peer.trustedPeers.length : 0) + 1;
        return Math.floor(totalNodes / 2) + 1;
    }

    // Cast strictly for structural bypass without polluting test integrity
    asPeerNode(): PeerNode {
        return this as unknown as PeerNode;
    }
}
