import assert from 'node:assert';
import { EventEmitter } from 'node:events';
import test, { describe, mock } from 'node:test';

import { generateRSAKeyPair } from '../../../crypto_utils/CryptoUtils';
import Mempool from '../../../models/mempool/Mempool';
import PeerNode from '../../../peer_node/PeerNode';
import { createMock } from '../../../test/utils/TestUtils';
import BftCoordinator from '../BftCoordinator';

describe('BftCoordinator', () => {
    test('start() isolates pending block arrays binding natively to event buses', async () => {
        const events = new EventEmitter();
        
        const mempoolStore = new Mempool();
        mempoolStore.pendingBlocks.set('mockBlockId', {
            block: { metadata: { index: 1 } } as any,
            verifications: new Set(),
            originalTimestamp: Date.now(),
            eligible: false
        });

        const mockLedger = createMock<any>({
            getLatestBlock: mock.fn<() => Promise<any>>(async () => ({ metadata: { index: 1 }, hash: 'oldTipHash' })),
            events: new EventEmitter(),
            blockAddedSubscribers: []
        });

        const keys = generateRSAKeyPair();

        const mockPeerNode = createMock<PeerNode>({
            mempool: mempoolStore,
            ledger: mockLedger,
            events: events,
            privateKey: keys.privateKey,
            port: 3000,
            getMajorityCount: mock.fn(() => 1) as any,
            peer: {
                broadcast: mock.fn(async () => {}) as any
            } as any
        });

        const coordinator = new BftCoordinator(mockPeerNode);
        coordinator.start();

        // Trigger the internal payload naturally without external overlapping lock promises
        events.emit('MEMPOOL:BLOCK_VERIFIED', 'mockBlockId');

        // BftCoordinator execution proxy will delay internally to process verification locks
        await new Promise(resolve => setTimeout(resolve, 300));

        const pendingEntry = mempoolStore.pendingBlocks.get('mockBlockId');
        assert.ok(pendingEntry !== undefined, "Pending entry incorrectly swept.");
        assert.ok(pendingEntry.verifications.has('127.0.0.1:3000'), "Coordinator failed to assert localized verification vote.");
        assert.strictEqual(pendingEntry.eligible, true, "Internal block did not become eligible after local vote matching majority.");
    });
});
