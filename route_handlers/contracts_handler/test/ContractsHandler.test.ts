import * as assert from 'assert';
import { describe, it, mock } from 'node:test';

import { Request, Response } from 'express';

import Ledger from '../../../ledger/Ledger';
import PeerNode from '../../../peer_node/PeerNode';
import { createMock } from '../../../test/utils/TestUtils';
import ContractsHandler from '../ContractsHandler';

describe('ContractsHandler', () => {

    it('Successfully maps physical ledger bounds natively', async () => {
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

        const mockReq = createMock<Request>({ query: {} });

        let chainObj: any;
        chainObj = {
             sort: mock.fn<any>(() => chainObj),
             skip: mock.fn<any>(() => chainObj),
             limit: mock.fn<any>(() => chainObj),
             toArray: mock.fn<any>(async () => [
                 { contractId: 'c1', signerAddress: 'originatorA', payload: { fragmentMap: [{ nodeId: 'hostPeer' }] } },
                 { contractId: 'c2', signerAddress: 'originatorB', payload: { fragmentMap: [{ nodeId: 'peerX' }] } }
             ])
        };

        const mockNode = createMock<PeerNode>({
            walletAddress: 'hostPeer',
            ledger: createMock<Ledger>({
                activeContractsCollection: {
                    countDocuments: mock.fn<any>(async () => 2),
                    find: mock.fn<any>(() => chainObj)
                } as any
            })
        });

        const handler = new ContractsHandler(mockNode);
        await handler.handle(mockReq, res);

        assert.strictEqual(mockResponseStatus.mock.calls.length, 1);
        assert.strictEqual(mockResponseStatus.mock.calls[0].arguments[0], 200);

        const responsePayload = mockResponseJson.mock.calls[0].arguments[0];
        assert.strictEqual(responsePayload.success, true);
        assert.strictEqual(responsePayload.contracts.total, 2);
        assert.strictEqual(responsePayload.contracts.data.length, 2);
        assert.strictEqual(responsePayload.contracts.data[0].isLocalHost, true);
        assert.strictEqual(responsePayload.contracts.data[1].isLocalHost, false);
    });

    it('Returns 503 strictly if structured collections miss bounding limits', async () => {
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

        const mockReq = createMock<Request>({ query: {} });
        const mockNode = createMock<PeerNode>({
            ledger: createMock<Ledger>({
                activeContractsCollection: null as any
            })
        });

        const handler = new ContractsHandler(mockNode);
        await handler.handle(mockReq, res);

        assert.strictEqual(mockResponseStatus.mock.calls[0].arguments[0], 503);
    });
});
