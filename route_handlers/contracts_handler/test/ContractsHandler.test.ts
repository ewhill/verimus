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

        const mockNode = createMock<PeerNode>({
            walletAddress: 'hostPeer',
            ledger: createMock<Ledger>({
                activeContractsCollection: {
                    find: mock.fn<any>(() => ({
                        toArray: mock.fn<any>(async () => [
                            { contractId: 'c1', signerAddress: 'originatorA', payload: { fragmentMap: [{ nodeId: 'hostPeer' }] } },
                            { contractId: 'c2', signerAddress: 'originatorB', payload: { fragmentMap: [{ nodeId: 'peerX' }] } }
                        ])
                    }))
                } as any
            })
        });

        const handler = new ContractsHandler(mockNode);
        await handler.handle(mockReq, res);

        assert.strictEqual(mockResponseStatus.mock.calls.length, 1);
        assert.strictEqual(mockResponseStatus.mock.calls[0].arguments[0], 200);

        const responsePayload = mockResponseJson.mock.calls[0].arguments[0];
        assert.strictEqual(responsePayload.success, true);
        assert.strictEqual(responsePayload.contracts.length, 2);
        assert.strictEqual(responsePayload.contracts[0].isLocalHost, true);
        assert.strictEqual(responsePayload.contracts[1].isLocalHost, false);
    });

    it('Filters natively if query owns are explicitly set', async () => {
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

        const mockReq = createMock<Request>({ query: { own: 'true' } });

        const mockNode = createMock<PeerNode>({
            walletAddress: 'hostPeer',
            ledger: createMock<Ledger>({
                activeContractsCollection: {
                    find: mock.fn<any>(() => ({
                        toArray: mock.fn<any>(async () => [
                            { contractId: 'c1', signerAddress: 'hostPeer', payload: { fragmentMap: [{ nodeId: 'hostPeer' }] } },
                            { contractId: 'c2', signerAddress: 'originatorB', payload: { fragmentMap: [{ nodeId: 'peerX' }] } }
                        ])
                    }))
                } as any
            })
        });

        const handler = new ContractsHandler(mockNode);
        await handler.handle(mockReq, res);

        const responsePayload = mockResponseJson.mock.calls[0].arguments[0];
        assert.strictEqual(responsePayload.contracts.length, 1);
        assert.strictEqual(responsePayload.contracts[0].contractId, 'c1');
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
