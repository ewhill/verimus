import * as assert from 'assert';
import { describe, it, mock } from 'node:test';

import { Request, Response } from 'express';

import { BLOCK_TYPES } from '../../../constants';
import ConsensusEngine from '../../../peer_handlers/consensus_engine/ConsensusEngine';
import PeerNode from '../../../peer_node/PeerNode';
import { createMock } from '../../../test/utils/TestUtils';
import ConsensusHandler from '../ConsensusHandler';

describe('ConsensusHandler', () => {

    it('Successfully maps internal mempool metrics', async () => {
        let currentStatus = 200;
        let res: Response;
        const mockResponseStatus = mock.fn<(_unusedCode: number) => Response>((code: number) => {
            currentStatus = code;
            return res;
        });
        const mockResponseJson = mock.fn<(_unusedBody?: any) => Response>();
        
        res = createMock<Response>({
            status: mockResponseStatus as any,
            json: mockResponseJson as any,
            get statusCode() { return currentStatus; }
        });

        const mockReq = createMock<Request>();

        const mempoolMap = new Map();
        mempoolMap.set('1234', {
            block: { type: BLOCK_TYPES.TRANSACTION, publicKey: 'peerA' },
            originalTimestamp: 1000,
            eligible: true,
            committed: false,
            verifications: new Set(['peerB'])
        });

        const mockNode = createMock<PeerNode>({
            consensusEngine: createMock<ConsensusEngine>({
                mempool: {
                    pendingBlocks: mempoolMap,
                    eligibleForks: new Map(),
                    settledForks: new Map()
                } as any
            })
        });

        const handler = new ConsensusHandler(mockNode);
        await handler.handle(mockReq, res);

        assert.strictEqual(mockResponseStatus.mock.calls.length, 1);
        assert.strictEqual(mockResponseStatus.mock.calls[0].arguments[0], 200);

        const responsePayload = mockResponseJson.mock.calls[0].arguments[0];
        assert.strictEqual(responsePayload.success, true);
        assert.strictEqual(responsePayload.mempool.pendingBlocks.length, 1);
        assert.strictEqual(responsePayload.mempool.pendingBlocks[0].hash, '1234');
        assert.strictEqual(responsePayload.mempool.pendingBlocks[0].verificationsCount, 1);
    });

    it('Returns 503 strictly if consensus engine misses bounding maps', async () => {
        let currentStatus = 200;
        let res: Response;
        const mockResponseStatus = mock.fn<(_unusedCode: number) => Response>((code: number) => {
            currentStatus = code;
            return res;
        });
        const mockResponseJson = mock.fn<(_unusedBody?: any) => Response>();
        
        res = createMock<Response>({
            status: mockResponseStatus as any,
            json: mockResponseJson as any,
            get statusCode() { return currentStatus; }
        });

        const mockReq = createMock<Request>();
        const mockNode = createMock<PeerNode>({
            consensusEngine: null as any
        });

        const handler = new ConsensusHandler(mockNode);
        await handler.handle(mockReq, res);

        assert.strictEqual(mockResponseStatus.mock.calls[0].arguments[0], 503);
    });
});
