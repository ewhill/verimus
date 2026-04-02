import assert from 'node:assert';
import { describe, it, beforeEach, mock } from 'node:test';

import type { Request, Response } from 'express';
import { Collection } from 'mongodb';

import type Ledger from '../../../ledger/Ledger';
import type PeerNode from '../../../peer_node/PeerNode';
import { createMock } from '../../../test/utils/TestUtils';
import type { Block } from '../../../types';
import LedgerMetricsHandler from '../LedgerMetricsHandler';

describe('Backend: LedgerMetricsHandler Coverage', () => {
    let mockNode: PeerNode;
    let mockLedger: Ledger;
    let mockCollection: Collection<Block>;
    let req: Request;
    let mockResponseJson: import('node:test').Mock<any>;
    let mockResponseStatus: import('node:test').Mock<any>;
    let res: Response;

    beforeEach(() => {
        // Setup mock express boundaries
        req = createMock<Request>({});
        mockResponseJson = mock.fn<(_unusedBody?: any) => Response>();
        let currentStatus = 200;
        mockResponseStatus = mock.fn<(_unusedCode: number) => Response>((code: number) => {
            currentStatus = code;
            return res;
        });
        res = createMock<Response>({
            json: mockResponseJson as any,
            status: mockResponseStatus as any,
            get statusCode() { return currentStatus; }
        });

        // Setup mock PeerNode architecture
        mockCollection = createMock<Collection<Block>>({
            // @ts-ignore: Mocking untyped native MongoDB driver stats extension
            stats: mock.fn(async () => ({ storageSize: 4096 } as any))
        });

        mockLedger = createMock<Ledger>({
            collection: mockCollection,
            // @ts-ignore: Bypassing strict MongoDB WithId generic limits for mock generation
            getLatestBlock: mock.fn(async () => createMock<Block>({
                metadata: { index: 42, timestamp: 12345 }
            }))
        });

        mockNode = createMock<PeerNode>({
            ledger: mockLedger
        });
    });

    it('Returns correct metrics with initialized ledger and active MongoDB stats', async () => {
        const handler = new LedgerMetricsHandler(mockNode);
        await handler.handle(req, res);

        const responseData = mockResponseJson.mock.calls.pop()?.arguments[0];
        assert.strictEqual(responseData.success, true);
        assert.strictEqual(responseData.currentIndex, 42);
        assert.strictEqual(responseData.epochSize, 1000000);
        assert.strictEqual(responseData.databaseFootprintBytes, 4096);
    });

    it('Returns base metrics when ledger block history is perfectly empty', async () => {
        // @ts-ignore
        mockLedger.getLatestBlock = mock.fn(async () => null);

        const handler = new LedgerMetricsHandler(mockNode);
        await handler.handle(req, res);

        const responseData = mockResponseJson.mock.calls.pop()?.arguments[0];
        assert.strictEqual(responseData.success, true);
        assert.strictEqual(responseData.currentIndex, 0);
        assert.strictEqual(responseData.databaseFootprintBytes, 4096);
    });

    it('Gracefully drops physical bytes allocation to 0 if MongoDB stats() driver returns an anomaly', async () => {
        // @ts-ignore
        mockCollection.stats = mock.fn(async () => { throw new Error('Driver unsupported'); });

        const handler = new LedgerMetricsHandler(mockNode);
        await handler.handle(req, res);

        const responseData = mockResponseJson.mock.calls.pop()?.arguments[0];
        assert.strictEqual(responseData.success, true);
        assert.strictEqual(responseData.currentIndex, 42);
        assert.strictEqual(responseData.databaseFootprintBytes, 0);
    });

    it('Propagates catastrophic internal exceptions resolving as native 500 error boundaries', async () => {
        // @ts-ignore
        mockLedger.getLatestBlock = mock.fn(async () => { throw new Error('Database disconnected'); });

        const handler = new LedgerMetricsHandler(mockNode);
        await handler.handle(req, res);

        assert.strictEqual(mockResponseStatus.mock.calls.pop()?.arguments[0], 500);
        const responseData = mockResponseJson.mock.calls.pop()?.arguments[0];
        assert.strictEqual(responseData.success, false);
        assert.strictEqual(responseData.message, 'Database disconnected');
    });
});
