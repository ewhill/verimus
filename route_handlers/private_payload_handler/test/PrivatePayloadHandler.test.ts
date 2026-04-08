import assert from 'node:assert';
import { describe, it, mock } from 'node:test';


import { ethers } from 'ethers';
import type { Request, Response } from 'express';
import { Collection, FindCursor, ObjectId, WithId } from 'mongodb';

import * as cryptoUtils from '../../../crypto_utils/CryptoUtils';
import type Ledger from '../../../ledger/Ledger';
import type Mempool from '../../../models/mempool/Mempool';
import type PeerNode from '../../../peer_node/PeerNode';
import { createSignedMockBlock } from '../../../test/utils/EIP712Mock';
import { createMock } from '../../../test/utils/TestUtils';
import type { Block } from '../../../types';
import PrivatePayloadHandler from '../PrivatePayloadHandler';


describe('Backend: privatePayloadHandler Coverage', () => {

    it('Returns 404 for nonexistent block hash checking ledger and mempool', async () => {
        const mockCollectionFind = mock.fn<() => FindCursor<WithId<Block>>>();
        mockCollectionFind.mock.mockImplementation(() => createMock<FindCursor<WithId<Block>>>({ toArray: async () => [] }));
        const mockCollection = createMock<Collection<Block>>({ find: mockCollectionFind as any });
        const mockNode: PeerNode = createMock<PeerNode>({ 
            ledger: createMock<Ledger>({ collection: mockCollection }), 
            mempool: createMock<Mempool>({ pendingBlocks: new Map() }) 
        });
        const handler = new PrivatePayloadHandler(mockNode);

        const req = createMock<Request>({ params: { hash: 'nonexistent' } });
        let response: Response;
        const mockStatus = mock.fn<(_unusedCode: number) => Response>((_unusedCode: number) => response);
        const mockJson = mock.fn<(_unusedBody?: any) => Response>();
        const mockSend = mock.fn<(_unusedBody?: any) => Response>();
        response = createMock<Response>({
            status: mockStatus as any,
            json: mockJson as any,
            send: mockSend as any
        });

        await handler.handle(req, response);
        assert.strictEqual(mockStatus.mock.calls[0]?.arguments[0], 404);
        assert.strictEqual(mockJson.mock.calls[0]?.arguments[0]?.success, false);
    });

    it('Returns 403 when public key mismatches authorization', async () => {
        const { publicKey: otherPubKey } = cryptoUtils.generateRSAKeyPair();
        const wallet = ethers.Wallet.createRandom();
        const timestamp = Date.now().toString();
        const web3Sig = await wallet.signMessage(JSON.stringify({ action: 'download', blockHash: 'exists', timestamp }));
        const payload = { encryptedPayloadBase64: Buffer.from(JSON.stringify({ physicalId: 'pid', location: { type: 'local' }, aesKey: '', aesIv: '', files: [] })).toString('base64'), ownerAddress: 'different_wallet_address' };
        const mockCollectionFind = mock.fn<() => FindCursor<WithId<Block>>>();
        mockCollectionFind.mock.mockImplementation(() => createMock<FindCursor<WithId<Block>>>({
            toArray: async () => [createMock<WithId<Block>>({
                _id: new ObjectId('000000000000000000000001'), metadata: { index: 0, timestamp: 0 }, hash: 'exists', previousHash: 'prev', signerAddress: otherPubKey, payload: payload, type: 'STORAGE_CONTRACT', signature: ''
            })]
        }));
        const mockCollection = createMock<Collection<Block>>({ find: mockCollectionFind as any });
        
        const mockNode: PeerNode = createMock<PeerNode>({ 
            publicKey: 'MY_KEY', 
            ledger: createMock<Ledger>({ collection: mockCollection }) 
        });
        const handler = new PrivatePayloadHandler(mockNode);

        const req = createMock<Request>({ headers: { 'x-web3-address': wallet ? wallet.address : 'other', 'x-web3-timestamp': timestamp, 'x-web3-signature': web3Sig }, params: { hash: 'exists' } });
        let response: Response;
        const mockStatus = mock.fn<(_unusedCode: number) => Response>((_unusedCode: number) => response);
        const mockJson = mock.fn<(_unusedBody?: any) => Response>();
        const mockSend = mock.fn<(_unusedBody?: any) => Response>();
        response = createMock<Response>({
            status: mockStatus as any,
            json: mockJson as any,
            send: mockSend as any
        });

        await handler.handle(req, response);
        assert.strictEqual(mockStatus.mock.calls[0]?.arguments[0], 403);
    });

    it('Catches exceptions and returns 500 error mapping', async () => {
        const mockCollectionFind = mock.fn<() => FindCursor<WithId<Block>>>();
        mockCollectionFind.mock.mockImplementation(() => { throw new Error('DB Error'); });
        const mockCollection = createMock<Collection<Block>>({ find: mockCollectionFind as any });
        const mockNode: PeerNode = createMock<PeerNode>({ ledger: createMock<Ledger>({ collection: mockCollection }) });
        const handler = new PrivatePayloadHandler(mockNode);

        const req = createMock<Request>({ headers: { 'x-web3-address': 'other', 'x-web3-timestamp': '12345', 'x-web3-signature': 'sig' }, params: { hash: 'exists' } });
        let response: Response;
        const mockStatus = mock.fn<(_unusedCode: number) => Response>((_unusedCode: number) => response);
        const mockJson = mock.fn<(_unusedBody?: any) => Response>();
        const mockSend = mock.fn<(_unusedBody?: any) => Response>();
        response = createMock<Response>({
            status: mockStatus as any,
            json: mockJson as any,
            send: mockSend as any
        });

        await handler.handle(req, response);
        assert.strictEqual(mockStatus.mock.calls[0]?.arguments[0], 500);
    });

    it('Gets block from mempool when missing in ledger', async () => {
        const { publicKey } = cryptoUtils.generateRSAKeyPair();
        const wallet = ethers.Wallet.createRandom();
        const timestamp = Date.now().toString();
        const web3Sig = await wallet.signMessage(JSON.stringify({ action: 'download', blockHash: 'memhash', timestamp }));
        const mockBlock = { hash: 'memhash', signerAddress: publicKey, payload: { encryptedPayloadBase64: Buffer.from(JSON.stringify({ physicalId: 'pid', location: { type: 'local' }, aesKey: '', aesIv: '', files: [] })).toString('base64'), ownerAddress: wallet ? wallet.address : 'other' }, signature: 'bad_sig', type: 'STORAGE_CONTRACT' as const, previousHash: 'prev', metadata: { index: -1, timestamp: 12345 } };
        
        const mockCollectionFind = mock.fn<() => FindCursor<WithId<Block>>>();
        mockCollectionFind.mock.mockImplementation(() => createMock<FindCursor<WithId<Block>>>({ toArray: async () => [] }));
        const mockCollection = createMock<Collection<Block>>({ find: mockCollectionFind as any });
        const mockNode: PeerNode = createMock<PeerNode>({ 
            publicKey, 
            ledger: createMock<Ledger>({ collection: mockCollection }),
            mempool: createMock<Mempool>({ pendingBlocks: new Map([['memhash', { block: mockBlock, committed: false, verifications: new Set<string>(), eligible: true, originalTimestamp: 0 }]]) })
        });
        const handler = new PrivatePayloadHandler(mockNode);

        const req = createMock<Request>({ headers: { 'x-web3-address': wallet.address, 'x-web3-timestamp': timestamp, 'x-web3-signature': web3Sig }, params: { hash: 'memhash' } });
        let response: Response;
        const mockStatus = mock.fn<(_unusedCode: number) => Response>((_unusedCode: number) => response);
        const mockJson = mock.fn<(_unusedBody?: any) => Response>();
        const mockSend = mock.fn<(_unusedBody?: any) => Response>();
        response = createMock<Response>({
            status: mockStatus as any,
            json: mockJson as any,
            send: mockSend as any
        });

        await handler.handle(req, response);
        // It should reach signature verification and fail there, which gives 401, confirming it found the block in mempool
        assert.strictEqual(mockStatus.mock.calls[0]?.arguments[0], 401);
    });

    it('Returns 401 when signature is invalid', async () => {
        const { publicKey, privateKey: _unusedPrivateKey } = cryptoUtils.generateRSAKeyPair();
        const wallet = ethers.Wallet.createRandom();
        const timestamp = Date.now().toString();
        const web3Sig = await wallet.signMessage(JSON.stringify({ action: 'download', blockHash: 'validh', timestamp }));
        const payload = { encryptedPayloadBase64: Buffer.from(JSON.stringify({ physicalId: 'pid', location: { type: 'local' }, aesKey: '', aesIv: '', files: [] })).toString('base64'), ownerAddress: wallet ? wallet.address : 'other' };
        const mockBlock = await createSignedMockBlock(wallet, 'STORAGE_CONTRACT', payload);
        const signedBlockWithId = { ...mockBlock, _id: new ObjectId('000000000000000000000001'), hash: 'validh' } as any;
        signedBlockWithId.signature = 'bad_sig';
        
        const mockCollectionFind = mock.fn<() => FindCursor<WithId<Block>>>();
        mockCollectionFind.mock.mockImplementation(() => createMock<FindCursor<WithId<Block>>>({
            toArray: async () => [signedBlockWithId]
        }));
        const mockCollection = createMock<Collection<Block>>({ find: mockCollectionFind as any });
        const mockNode: PeerNode = createMock<PeerNode>({ 
            publicKey, 

            ledger: createMock<Ledger>({ collection: mockCollection })
        });
        const handler = new PrivatePayloadHandler(mockNode);

        const req = createMock<Request>({ headers: { 'x-web3-address': wallet.address, 'x-web3-timestamp': timestamp, 'x-web3-signature': web3Sig }, params: { hash: 'validh' } });
        let response: Response;
        const mockStatus = mock.fn<(_unusedCode: number) => Response>((_unusedCode: number) => response);
        const mockJson = mock.fn<(_unusedBody?: any) => Response>();
        const mockSend = mock.fn<(_unusedBody?: any) => Response>();
        response = createMock<Response>({
            status: mockStatus as any,
            json: mockJson as any,
            send: mockSend as any
        });

        await handler.handle(req, response);
        assert.strictEqual(mockStatus.mock.calls[0]?.arguments[0], 401);
        assert.strictEqual(mockJson.mock.calls[0]?.arguments[0]?.message || mockSend.mock.calls[0]?.arguments[0]?.message, 'Invalid block signature.');
    });

    it('Returns 401 on invalid Web3 signature mapping', async () => {
        const { publicKey } = cryptoUtils.generateRSAKeyPair();
        const wallet = ethers.Wallet.createRandom();
        const timestamp = Date.now().toString();
        const web3Sig = await wallet.signMessage(JSON.stringify({ action: 'download', blockHash: 'validh', timestamp }));
        const priv = { physicalId: 'pid', key: 'key', iv: 'iv', location: { type: 'local'}, files: [] };
        const encPriv = { encryptedPayloadBase64: Buffer.from(JSON.stringify(priv)).toString('base64'), encryptedKeyBase64: '', encryptedIvBase64: '', ownerAddress: wallet.address };
        const mockBlock = await createSignedMockBlock(wallet, 'STORAGE_CONTRACT', encPriv);
        const signedBlockWithId = { ...mockBlock, _id: new ObjectId('000000000000000000000001'), hash: 'validh' } as any;

        const mockCollectionFind = mock.fn<() => FindCursor<WithId<Block>>>();
        mockCollectionFind.mock.mockImplementation(() => createMock<FindCursor<WithId<Block>>>({
            toArray: async () => [signedBlockWithId]
        }));
        const mockCollection = createMock<Collection<Block>>({ find: mockCollectionFind as any });
        const mockNode: PeerNode = createMock<PeerNode>({ 
            publicKey, 
            
            ledger: createMock<Ledger>({ collection: mockCollection })
        });
        const handler = new PrivatePayloadHandler(mockNode);

        const req = createMock<Request>({ headers: { 'x-web3-address': wallet.address, 'x-web3-timestamp': timestamp, 'x-web3-signature': web3Sig }, params: { hash: 'validh' } });
        let response: Response;
        const mockStatus = mock.fn<(_unusedCode: number) => Response>((_unusedCode: number) => response);
        const mockJson = mock.fn<(_unusedBody?: any) => Response>();
        const mockSend = mock.fn<(_unusedBody?: any) => Response>();
        response = createMock<Response>({
            status: mockStatus as any,
            json: mockJson as any,
            send: mockSend as any
        });

        await handler.handle(req, response);
        // Provide a modified bad signature for this specific assertion
        const badWeb3Sig = await wallet.signMessage(JSON.stringify({ action: 'download', blockHash: 'bad_hash', timestamp }));
        req.headers['x-web3-signature'] = badWeb3Sig;
        
        const mockStatus2 = mock.fn<(_unusedCode: number) => Response>((_unusedCode: number) => response);
        const mockJson2 = mock.fn<(_unusedBody?: any) => Response>();
        response.status = mockStatus2 as any;
        response.json = mockJson2 as any;

        await handler.handle(req, response);
        console.log("MOCK CALLS STATUS:", mockStatus2.mock.calls);
        console.log("MOCK CALLS JSON:", mockJson2.mock.calls);
        assert.strictEqual(mockStatus2.mock.calls[0]?.arguments[0], 401);
        assert.strictEqual(mockJson2.mock.calls[0]?.arguments[0]?.message, 'Invalid EIP-191 explicit resolution structurally mapped array bounds.');
    });

    it('Returns HTTP 200 returning deeply nested raw unencrypted private structures', async () => {
        const { publicKey, privateKey: _unusedPrivateKey } = cryptoUtils.generateRSAKeyPair();
        const wallet = ethers.Wallet.createRandom();
        const timestamp = Date.now().toString();
        const web3Sig = await wallet.signMessage(JSON.stringify({ action: 'download', blockHash: 'validh', timestamp }));
        const priv = { physicalId: 'pid', key: 'key', iv: 'iv', location: { type: 'local' }, files: [] };
        const encPriv = { encryptedPayloadBase64: Buffer.from(JSON.stringify(priv)).toString('base64'), encryptedKeyBase64: '', encryptedIvBase64: '', ownerAddress: wallet.address };
        const mockBlock = await createSignedMockBlock(wallet, 'STORAGE_CONTRACT', encPriv);
        const signedBlockWithId = { ...mockBlock, _id: new ObjectId('000000000000000000000001'), hash: 'validh' } as any;

        const mockCollectionFind = mock.fn<() => FindCursor<WithId<Block>>>();
        mockCollectionFind.mock.mockImplementation(() => createMock<FindCursor<WithId<Block>>>({
            toArray: async () => [signedBlockWithId]
        }));
        const mockCollection = createMock<Collection<Block>>({ find: mockCollectionFind as any });
        const mockNode: PeerNode = createMock<PeerNode>({ 
            publicKey, 

            ledger: createMock<Ledger>({ collection: mockCollection })
        });
        const handler = new PrivatePayloadHandler(mockNode);

        const req = createMock<Request>({ headers: { 'x-web3-address': wallet.address, 'x-web3-timestamp': timestamp, 'x-web3-signature': web3Sig }, params: { hash: 'validh' } });
        let response: Response;
        const mockStatus = mock.fn<(_unusedCode: number) => Response>((_unusedCode: number) => response);
        const mockJson = mock.fn<(_unusedBody?: any) => Response>();
        const mockSend = mock.fn<(_unusedBody?: any) => Response>();
        response = createMock<Response>({
            status: mockStatus as any,
            json: mockJson as any,
            send: mockSend as any
        });

        await handler.handle(req, response);
        assert.ok(mockJson.mock.calls[0]?.arguments[0]?.success);
        assert.strictEqual(mockJson.mock.calls[0]?.arguments[0]?.payload?.physicalId, 'pid');
    });
});
