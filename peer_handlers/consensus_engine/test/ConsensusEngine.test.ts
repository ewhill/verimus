import assert from 'node:assert';
import { EventEmitter } from 'node:events';
import { describe, it, mock } from 'node:test';

import { ethers } from 'ethers';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { BLOCK_TYPES } from '../../../constants';
import Mempool from '../../../models/mempool/Mempool';
import type PeerNode from '../../../peer_node/PeerNode';
import { createSignedMockBlock } from '../../../test/utils/EIP712Mock';
import { createMock } from '../../../test/utils/TestUtils';
import ConsensusEngine from '../ConsensusEngine';

describe('Backend: ConsensusEngine Integration Pipeline', () => {
    let mongoServer: MongoMemoryServer;
    let mongoClient: MongoClient;

    it('Reroutes P2P traffic effectively triggering isolated bus events hermetically', async () => {
        mongoServer = await MongoMemoryServer.create();
        const uri = mongoServer.getUri();
        mongoClient = new MongoClient(uri);
        await mongoClient.connect();
        const db = mongoClient.db('mock-verimus');
        const collection = db.collection('blocks');

        const events = new EventEmitter();
        let blockVerifiedEmitted: boolean = false;
        
        events.on('MEMPOOL:BLOCK_VERIFIED', () => {
            blockVerifiedEmitted = true;
        });

        const mockLedger = createMock<any>({
            collection: collection,
            getLatestBlock: mock.fn<() => Promise<any>>(async () => null),
            events: new EventEmitter()
        });

        const mempoolStore = new Mempool();
        const mockPeerNode = createMock<PeerNode>({
            mempool: mempoolStore,
            ledger: mockLedger,
            events: events,
            peer: {
                bind: mock.fn<() => any>(() => ({ to: mock.fn() })),
                broadcast: mock.fn<() => Promise<void>>(async () => {})
            } as any,
            syncEngine: { currentState: 'OFFLINE' } as any,
            reputationManager: createMock<any>({ 
                penalizeCritical: mock.fn<() => Promise<void>>(async () => {}),
                penalizeMajor: mock.fn<() => Promise<void>>(async () => {}),
                rewardHonestProposal: mock.fn<() => Promise<void>>(async () => {}) 
            }),
            port: 3000
        });

        const engine = new ConsensusEngine(mockPeerNode);
        engine.bindHandlers(); 
        
        engine.node.walletManager = createMock<any>({
            verifyFunds: mock.fn<() => Promise<boolean>>(async () => true)
        });

        const wallet = ethers.Wallet.createRandom();
        // Create genuinely valid EIP712 block resolving structural bounds effectively natively
        const validBlock = await createSignedMockBlock(wallet, BLOCK_TYPES.TRANSACTION, { senderSignature: '', senderAddress: ethers.ZeroAddress, recipientAddress: ethers.ZeroAddress, amount: 0n }, 5);
        
        engine.node.events.emit('NETWORK:INBOUND_PENDING_BLOCK', validBlock);

        await new Promise(r => setTimeout(r, 150));

        try {
            assert.strictEqual(blockVerifiedEmitted, true, "MEMPOOL:BLOCK_VERIFIED was not triggered across the pipeline bridge organically.");
        } finally {
            engine.stop();
            await mongoClient.close();
            await mongoServer.stop();
        }
    });
});
