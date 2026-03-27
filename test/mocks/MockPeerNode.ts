import type { EventEmitter } from 'events';
import { EventEmitter as Events } from 'events';
import type { Server } from 'https';

import type { Db } from 'mongodb';

import { MockBundler } from './MockBundler';
import { MockConsensusEngine } from './MockConsensusEngine';
import { MockMempool } from './MockMempool';
import { MockPeer } from './MockPeer';
import { MockReputationManager } from './MockReputationManager';
import { MockSyncEngine } from './MockSyncEngine';
import type Bundler from '../../bundler/Bundler';
import type { PeerCredentials } from '../../credential_provider/CredentialProvider';
import type Ledger from '../../ledger/Ledger';
import type Mempool from '../../models/mempool/Mempool';
import type { Peer } from '../../p2p';
import type ConsensusEngine from '../../peer_handlers/consensus_engine/ConsensusEngine';
import type { ReputationManager } from '../../peer_handlers/reputation_manager/ReputationManager';
import type SyncEngine from '../../peer_handlers/sync_engine/SyncEngine';
import type PeerNode from '../../peer_node/PeerNode';
import type BaseProvider from '../../storage_providers/base_provider/BaseProvider';
import type { Block } from '../../types';
import { NodeRole } from '../../types/NodeRole';
import { createMongoCursorStub, createMock } from '../utils/StubFactory';

// Needs events import for base events natively

export class MockPeerNode {
    port: number = 3000;
    discoverAddresses: string[] = [];
    publicAddress: string | null = '127.0.0.1:3000';
    ledger!: Ledger;
    peer!: Peer | null;
    storageProvider!: BaseProvider | null;
    bundler!: Bundler | null;
    keyPaths!: PeerCredentials;
    mempool!: Mempool;
    dataDir: string = 'data';
    db: Db | null = null;
    ownedBlocksCache: string[] = [];
    consensusEngine!: ConsensusEngine;
    syncEngine!: SyncEngine;
    reputationManager!: ReputationManager;
    events!: EventEmitter;
    publicKey: string = 'MOCK_PUB_KEY';
    privateKey: string = 'MOCK_PRIV_KEY';
    signature: string = 'MOCK_SIGNATURE';
    httpServer?: Server;
    isHeadless: boolean = false;
    roles: NodeRole[] = [NodeRole.ORIGINATOR, NodeRole.STORAGE];

    constructor(options: Partial<MockPeerNode> = {}) {
        Object.assign(this, options);
        this.ledger = this.ledger || createMock<Ledger>({
            init: async () => {},
            collection: {
                find: () => createMongoCursorStub([]),
                findOne: async () => null,
                countDocuments: async () => 1,
                insertMany: async () => {}
            } as any,
            ownedBlocksCollection: {
                find: () => createMongoCursorStub([]),
                insertOne: async () => {},
                insertMany: async () => {},
                deleteMany: async () => {},
                countDocuments: async () => 1
            } as any,
            peersCollection: {
                find: () => createMongoCursorStub([]),
                updateOne: async () => {},
                findOne: async () => null
            } as any,
            getLatestBlock: async () => { return null as any; },
            addBlockToChain: async () => { return null as any; },
            isChainValid: async () => true,
            purgeChain: async () => {},
            events: new Events()
        });
        
        // These can be null by default based on the peer interfaces or initialized as provided
        this.peer = this.peer || createMock<Peer>(new MockPeer() as any);
        this.storageProvider = this.storageProvider || null;
        this.bundler = this.bundler || new MockBundler();
        this.keyPaths = this.keyPaths || { publicKeyPath: '', privateKeyPath: '', signaturePath: '' };
        this.mempool = this.mempool || (new MockMempool() as unknown as Mempool); 
        this.consensusEngine = this.consensusEngine || createMock<ConsensusEngine>(new MockConsensusEngine(this as any)); 
        this.syncEngine = this.syncEngine || createMock<SyncEngine>(new MockSyncEngine(this as any));
        this.reputationManager = this.reputationManager || (new MockReputationManager() as unknown as ReputationManager);
        this.events = this.events || new Events();
    }

    async init() {}
    async loadOwnedBlocksCache() {}
    async addOwnedBlockToCache(_unusedBlock: Block) {}
    getMajorityCount() { return 1; }
    asPeerNode(): PeerNode { return createMock<PeerNode>(this as any); }
}
