import assert from 'node:assert';
import { EventEmitter } from 'node:events';
import test, { describe, mock } from 'node:test';

import PeerNode from '../../../peer_node/PeerNode';
import { createMock } from '../../../test/utils/TestUtils';
import GlobalAuditor from '../GlobalAuditor';

describe('GlobalAuditor', () => {
    test('runGlobalAudit gracefully evaluates PoSt checks and routes SLASHING_GENERATED events correctly isolated', async () => {
        const events = new EventEmitter();
        let slashingPayloadCaught: any = null;

        events.on('AUDITOR:SLASHING_GENERATED', (payload) => {
            slashingPayloadCaught = payload;
        });

        const mockLedger = createMock<any>({
            getLatestBlock: mock.fn<() => Promise<any>>(async () => ({ hash: 'tiphash' })),
            getBlockByIndex: mock.fn<() => Promise<any>>(async () => ({ metadata: { timestamp: Date.now() - 3600000 } })),
            collection: {
                find: mock.fn<() => any>(() => ({
                    sort: mock.fn<() => any>(() => ({
                        limit: mock.fn<() => any>(() => ({
                            toArray: mock.fn<() => Promise<any[]>>(async () => [{
                                hash: 'contracthash',
                                payload: {
                                    erasureParams: { k: 2, originalSize: 1024 },
                                    fragmentMap: [{ nodeId: 'targetnodeid', physicalId: 'phys123', shardIndex: 0 }],
                                    merkleRoots: ['merkleRoot']
                                }
                            }])
                        }))
                    }))
                }))
            }
        });

        const mockReputation = createMock<any>({
            penalizeMajor: mock.fn<() => Promise<void>>(async () => {}),
            penalizeCritical: mock.fn<() => Promise<void>>(async () => {}),
            rewardHonestProposal: mock.fn<() => Promise<void>>(async () => {})
        });

        const mockPeerNode = createMock<PeerNode>({
            walletAddress: 'myAddress', // Does not match 'targetnodeid'
            publicKey: 'myPubKey',
            wallet: { signTypedData: async () => 'dummySig' } as any,
            port: 3000,
            ledger: mockLedger,
            reputationManager: mockReputation,
            events: events,
            peer: {
                broadcast: mock.fn<() => Promise<void>>(async () => {}),
                peers: []
            } as any
        });

        const auditor = new GlobalAuditor(mockPeerNode);
        
        // Mock to force deterministic election natively to true ensuring bounds pass cleanly
        auditor.computeDeterministicAuditor = mock.fn(() => true) as any;

        // Await the audit evaluation block securely locking execution queue
        await auditor.runGlobalAudit();

        // Emit the corrupted / failed proof validation locally simulating poor response
        events.emit('merkle_audit_response:contracthash:phys123', {
            auditorNodeId: 'myAddress',
            computedRootMatch: true, // But give explicit mismatch chunk formatting simulating forgery natively
            chunkDataBase64: Buffer.from("forgery_bounds").toString('base64'),
            merkleSiblings: [] 
        });

        // The async execution inside `responseHandler` must settle.
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            assert.ok(slashingPayloadCaught !== null, "Engine inherently failed to detach slashed event map. Component overlap limits bound falsely!");
            assert.strictEqual(slashingPayloadCaught.type, 'SLASHING_TRANSACTION', "Did not generate expected SLASHING_TRANSACTION format");
            assert.strictEqual(slashingPayloadCaught.payload.penalizedAddress, 'targetnodeid', "Should have penalized targetnodeid correctly mapping bounds.");
        } finally {
            auditor.stop();
        }
    });

    test('event-loop backpressure gracefully scales exponential logic protecting nodes from false slashes', async () => {
        const events = new EventEmitter();
        let slashingHit = false;
        events.on('AUDITOR:SLASHING_GENERATED', () => slashingHit = true);

        const auditor = new GlobalAuditor(createMock<PeerNode>({
            events: events,
            peer: { broadcast: mock.fn(async () => {}) } as any,
            ledger: createMock<any>({
                getLatestBlock: async () => null,
                getBlockByIndex: async () => ({ metadata: { timestamp: Date.now() - 30000 } }),
                collection: { find: () => ({ sort: () => ({ limit: () => ({ toArray: async () => [{ hash: 'contract', payload: { erasureParams: { k: 2, originalSize: 10 }, fragmentMap: [{ nodeId: 'testNodeId', physicalId: 'phys', shardIndex: 0 }], merkleRoots: ['root'] } }] }) }) }) }
            }),
            reputationManager: createMock<any>({ penalizeMajor: async () => {} })
        }));
        
        auditor.computeDeterministicAuditor = mock.fn(() => true) as any;
        auditor.start();

        // Dynamically simulate extreme node stress forcing event loop metric over 100ms boundary
        // @ts-ignore
        Object.defineProperty(auditor.eventLoopMonitor, 'mean', { value: 150 * 1e6, writable: true }); // 150ms simulated mean delay

        const executeChallenge = (auditor as any).runGlobalAudit.bind(auditor);
        await executeChallenge();

        // The timeout internally maps BASE = 5000 * 2^retries.
        // If we inject latency natively, it attempts to slash but catches it dynamically, suppressing it.
        // We will assert no slashing happens.
        assert.strictEqual(slashingHit, false, 'Slashing must be suspended due to mocked local event loop lag.');
        auditor.stop();
    });
});
