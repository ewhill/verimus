import assert from 'node:assert';
import { describe, it, mock } from 'node:test';

import { Request, Response } from 'express';

import Ledger from '../../../ledger/Ledger';
import { Peer } from '../../../p2p';
import type PeerNode from '../../../peer_node/PeerNode';
import { createMock } from '../../../test/utils/TestUtils';
import PeersHandler from '../PeersHandler';

describe('Backend: peersHandler Integrity', () => {
    it('Returns empty array when no peer data exists globally', async () => {
        const mockRequest = createMock<Request>({});
        let mockResponse: Response;
        const mockResponseJson = mock.fn<(_unusedBody?: any) => Response>((_unusedBody?: any) => mockResponse);
        mockResponse = createMock<Response>({ json: mockResponseJson });

        const mockNode = createMock<PeerNode>({
            ledger: createMock<Ledger>({}),
            peer: createMock<Peer>({}),
            publicKey: 'MOCK_PUB_KEY'
        });
        const handler = new PeersHandler(mockNode);
        await handler.handle(mockRequest, mockResponse);

        assert.strictEqual(mockResponseJson.mock.calls.length, 1);
        const data = mockResponseJson.mock.calls.pop()?.arguments[0];
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.peers.length, 1); // MockPeerNode provides publicKey, so 'self' is always listed.
    });

    it('Maps populated local peer structs matching API expectations', async () => {
        const mockRequest = createMock<Request>({});
        let mockResponse: Response;
        const mockResponseJson = mock.fn<(_unusedBody?: any) => Response>((_unusedBody?: any) => mockResponse);
        mockResponse = createMock<Response>({ json: mockResponseJson });

        const mockNode = createMock<PeerNode>({
            ledger: createMock<Ledger>({}),
            publicKey: 'MOCK_PUB_KEY',
            peer: createMock<Peer>({
                peers: [
                    {
                        peerAddress: 'host1',
                        remoteSignature: Buffer.from('remoteSig000000000000000000000'),
                        isConnected: true,
                        isTrusted: true
                    },
                    {
                        peerAddress: 'host2',
                        remoteSignature: null,
                        isConnected: true,
                        isTrusted: false
                    },
                    {
                        peerAddress: 'host3',
                        remoteSignature: null,
                        isConnected: false
                    },
                    {
                        // missing peerAddress
                        remoteSignature: null,
                        isConnected: false
                    }
                ]
            })
        });

        const handler = new PeersHandler(mockNode);
        await handler.handle(mockRequest, mockResponse);

        assert.strictEqual(mockResponseJson.mock.calls.length, 1);
        const data = mockResponseJson.mock.calls.pop()?.arguments[0];
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.peers.length, 5); // 1 self + 4 mock peers
        assert.strictEqual(data.connectedCount, 1);

        const expectedSig = Buffer.from('MOCK_PUB_KEY').toString('base64').slice(-16);
        assert.strictEqual(data.peers[0].status, 'self');
        assert.strictEqual(data.peers[0].signature, expectedSig); // self signature from MockPeerNode
        assert.strictEqual(data.peers[1].status, 'connected');
        assert.strictEqual(data.peers[2].status, 'upgrading');
        assert.strictEqual(data.peers[3].status, 'disconnected');
        assert.strictEqual(data.peers[4].address, 'unknown'); // missing peerAddress fallback
    });

    it('Defaults to an empty peers array preventing missing definition crashes', async () => {
        const mockRequest = createMock<Request>({});
        let mockResponse: Response;
        const mockResponseJson = mock.fn<(_unusedBody?: any) => Response>((_unusedBody?: any) => mockResponse);
        mockResponse = createMock<Response>({ json: mockResponseJson });

        const mockNode = createMock<PeerNode>({
            ledger: createMock<Ledger>({}),
            publicKey: 'MOCK_PUB_KEY',
            peer: createMock<Peer>({})
        });

        const handler = new PeersHandler(mockNode);
        await handler.handle(mockRequest, mockResponse);

        assert.strictEqual(mockResponseJson.mock.calls.length, 1);
        const data = mockResponseJson.mock.calls.pop()?.arguments[0];
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.peers.length, 1); // Only self
    });

    it('Catches exceptions and returns 500 error', async () => {
        const mockRequest = createMock<Request>({});
        let mockResponseObj: any;
        const mockResponseStatus = mock.fn<(_unusedCode: number) => Response>((_unusedCode: number) => mockResponseObj);
        const mockResponseJson = mock.fn<(_unusedBody?: any) => Response>((_unusedBody?: any) => mockResponseObj);
        mockResponseObj = createMock<Response>({
            status: mockResponseStatus,
            json: mockResponseJson
        });

        const mockNode = createMock<PeerNode>({
            ledger: createMock<Ledger>({}),
            publicKey: 'MOCK_PUB_KEY',
            peer: createMock<Peer>({
                get peers(): string[] {
                    throw new Error("peer crash test");
                }
            })
        });

        const handler = new PeersHandler(mockNode);
        await handler.handle(mockRequest, mockResponseObj);

        assert.strictEqual(mockResponseStatus.mock.calls.length, 1);
        assert.strictEqual(mockResponseStatus.mock.calls.pop()?.arguments[0], 500);

        assert.strictEqual(mockResponseJson.mock.calls.length, 1);
        const data = mockResponseJson.mock.calls.pop()?.arguments[0];
        assert.strictEqual(data.success, false);
    });
});
