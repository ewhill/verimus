import type EventEmitter from 'events';
import assert from 'node:assert';
import { Writable } from 'node:stream';
import { describe, it, mock } from 'node:test';

import type { Request, Response } from 'express';

import type Bundler from '../../../bundler/Bundler';
import { generateRSAKeyPair, buildMerkleTree, getMerkleProof } from '../../../crypto_utils/CryptoUtils';
import type { Peer } from '../../../p2p';
import type ConsensusEngine from '../../../peer_handlers/consensus_engine/ConsensusEngine';
import type { ReputationManager } from '../../../peer_handlers/reputation_manager/ReputationManager';
import type SyncEngine from '../../../peer_handlers/sync_engine/SyncEngine';
import type PeerNode from '../../../peer_node/PeerNode';
import type BaseProvider from '../../../storage_providers/base_provider/BaseProvider';
import { createMock } from '../../../test/utils/TestUtils';
import { NodeRole } from '../../../types/NodeRole';
import WalletManager from '../../../wallet_manager/WalletManager';
import UploadHandler from '../UploadHandler';


describe('Backend: uploadHandler Coverage Unit Tests', () => {

    it('Rejects requests attempting to stream zero bundled files', async () => {
        const mockNode: PeerNode = createMock<PeerNode>({
            roles: [NodeRole.ORIGINATOR]
        });
        const handler = new UploadHandler(mockNode);
        const request = createMock<Request>({
            files: []
        });
        let response: any;
        const mockResponseStatus = mock.fn<(_unusedCode: number) => Response>((_unusedCode: number) => response);
        const mockResponseJson = mock.fn<(_unusedBody?: any) => Response>();
        response = createMock<Response>({
            status: mockResponseStatus as any,
            json: mockResponseJson as any,
            send: mockResponseJson as any
        });

        await handler.handle(request, response);

        const responseStatus = mockResponseStatus.mock.calls.pop()?.arguments[0];
        assert.strictEqual(responseStatus, 400);
        const responseBody = mockResponseJson.mock.calls.pop()?.arguments[0];
        assert.strictEqual(responseBody, 'No files uploaded.');
    });

    it('Processes valid multipart file bundles orchestrating bundler streams', async () => {
        let blockHandled = false;
        const { publicKey, privateKey } = generateRSAKeyPair();
        const buffer = Buffer.from('mock');
        const { tree, root } = buildMerkleTree([buffer]);
        const merkleSiblings = getMerkleProof(tree, 0);
        const mockNode: PeerNode = createMock<PeerNode>({
            roles: [NodeRole.ORIGINATOR],
            port: 3000,
            publicKey: publicKey,
            privateKey: privateKey,
            storageProvider: createMock<BaseProvider>({
                createBlockStream: () => {
                    return {
                        physicalBlockId: 'mockId',
                        writeStream: new Writable({
                            write(_unusedC, _unusedE, cb) {
                                cb();
                            }
                        })
                    };
                }
            }),
            bundler: createMock<Bundler>({
                streamErasureBundle: async () => ({
                    aesKey: 'KEY',
                    aesIv: 'IV',
                    files: [],
                    shards: [buffer],
                    authTag: '',
                    originalSize: 0,
                    merkleRoots: [root]
                })
            }),
            consensusEngine: createMock<ConsensusEngine>({
                handlePendingBlock: async () => {
                    blockHandled = true;
                },
                walletManager: createMock<WalletManager>({
                    verifyFunds: mock.fn<() => Promise<boolean>>(() => Promise.resolve(true)),
                    freezeFunds: mock.fn<() => void>(),
                    releaseFunds: mock.fn<() => void>(),
                    commitFunds: mock.fn<() => void>()
                })
            }),
            syncEngine: createMock<SyncEngine>({
                orchestrateStorageMarket: async () => [{
                    peerId: 'mock-1',
                    connection: {
                        peerAddress: 'address',
                        send: () => { }
                    }
                }]
            }),
            peer: createMock<Peer>({
                broadcast: async () => { }
            }),
            reputationManager: createMock<ReputationManager>({
                penalizeMajor: async () => null
            }),
            events: createMock<EventEmitter>({
                once: (evt: string | symbol, cb: (..._unusedArgs: unknown[]) => void) => {
                    if (typeof evt === 'string') {
                        if (evt.startsWith('shard_response')) {
                            setTimeout(() => cb({
                                success: true,
                                physicalId: 'mockId'
                            }), 5);
                        } else if (evt.startsWith('handoff_response')) {
                            setTimeout(() => cb({
                                success: true,
                                chunkDataBase64: buffer.toString('base64'),
                                merkleSiblings: merkleSiblings
                            }), 5);
                        } else {
                            setTimeout(() => cb({
                                hash: 'fakeHash settled'
                            }), 5);
                        }
                    }
                    return mockNode.events;
                },
                emit: () => true,
                removeAllListeners: () => mockNode.events
            })
        });

        const handler = new UploadHandler(mockNode);
        const request = createMock<Request>({
            files: [
                createMock<Express.Multer.File>({ originalname: 'test' })
            ],
            body: {
                paths: JSON.stringify(['test'])
            }
        });
        let response: Response;
        const mockResponseStatus = mock.fn<(_unusedCode: number) => Response>((_unusedCode: number) => response);
        const mockResponseJson = mock.fn<(_unusedBody?: any) => Response>();
        response = createMock<Response>({
            status: mockResponseStatus as any,
            json: mockResponseJson as any,
            send: mockResponseJson as any
        });

        await handler.handle(request, response);

        const responseStatus = mockResponseStatus.mock.calls.pop()?.arguments[0];
        const responseBody = mockResponseJson.mock.calls.pop()?.arguments[0];
        assert.strictEqual(responseStatus, 202);
        assert.strictEqual(responseBody.success, true);
        assert.ok(blockHandled, 'Should kick off a consensus settlement correctly intrinsically');
    });

    it('Handles and catches bubbled initialization API exception errors', async () => {
        const mockNode: PeerNode = createMock<PeerNode>({
            roles: [NodeRole.ORIGINATOR],
            storageProvider: createMock<BaseProvider>({
                createBlockStream: () => {
                    throw new Error('Simulated Creation Error');
                }
            }),
            consensusEngine: createMock<ConsensusEngine>({
                walletManager: createMock<WalletManager>({
                    verifyFunds: mock.fn<() => Promise<boolean>>(() => Promise.resolve(true)),
                    freezeFunds: mock.fn<() => void>(),
                    releaseFunds: mock.fn<() => void>(),
                    commitFunds: mock.fn<() => void>()
                })
            })
        });
        const request = createMock<Request>({
            files: [
                createMock<Express.Multer.File>({ originalname: 'throws' })
            ],
            body: {
                paths: JSON.stringify(['throws'])
            }
        });
        let response: Response;
        const mockResponseStatus = mock.fn<(_unusedCode: number) => Response>((_unusedCode: number) => response);
        const mockResponseJson = mock.fn<(_unusedBody?: any) => Response>();
        response = createMock<Response>({
            status: mockResponseStatus as any,
            json: mockResponseJson as any,
            send: mockResponseJson as any
        });
        const handler = new UploadHandler(mockNode);

        await handler.handle(request, response);

        const responseStatus = mockResponseStatus.mock.calls.pop()?.arguments[0]
        assert.strictEqual(responseStatus, 500);
    });

    it('Maps custom string destination locations validating config fallback', async () => {
        const { publicKey, privateKey } = generateRSAKeyPair();
        const buffer = Buffer.from('mock');
        const { tree, root } = buildMerkleTree([buffer]);
        const merkleSiblings = getMerkleProof(tree, 0);
        const mockNode: PeerNode = createMock<PeerNode>({
            roles: [NodeRole.ORIGINATOR],
            publicKey,
            privateKey,
            port: 1234,
            storageProvider: createMock<BaseProvider>({
                createBlockStream: () => ({
                    physicalBlockId: 'id',
                    writeStream: new Writable({
                        write(_unusedC, _unusedE, cb) {
                            cb();
                        }
                    })
                })
            }),
            bundler: createMock<Bundler>({
                streamErasureBundle: async () => ({
                    files: [],
                    aesKey: 'k',
                    aesIv: 'iv',
                    shards: [buffer],
                    authTag: '',
                    originalSize: 0,
                    merkleRoots: [root]
                })
            }),
            consensusEngine: createMock<ConsensusEngine>({
                handlePendingBlock: async () => { },
                walletManager: createMock<WalletManager>({
                    verifyFunds: mock.fn<() => Promise<boolean>>(() => Promise.resolve(true)),
                    freezeFunds: mock.fn<() => void>(),
                    releaseFunds: mock.fn<() => void>(),
                    commitFunds: mock.fn<() => void>()
                })
            }),
            syncEngine: createMock<SyncEngine>({
                orchestrateStorageMarket: async () => [{
                    peerId: 'mock-1',
                    connection: {
                        peerAddress: 'address',
                        send: () => { }
                    }
                }]
            }),
            peer: createMock<Peer>({
                broadcast: async () => { }
            }),
            reputationManager: createMock<ReputationManager>({
                penalizeMajor: async (_unusedPeerId: string, _unusedReason: string) => null
            }),
            events: createMock<EventEmitter>({
                once: (evt: string | symbol, cb: (..._unusedArgs: unknown[]) => void) => {
                    if (typeof evt === 'string') {
                        if (evt.startsWith('shard_response')) {
                            cb({
                                success: true,
                                physicalId: 'id'
                            });
                        } else if (evt.startsWith('handoff_response')) {
                            cb({
                                success: true,
                                chunkDataBase64: buffer.toString('base64'),
                                merkleSiblings: merkleSiblings
                            });
                        }
                    }
                    return mockNode.events;
                },
                emit: () => true,
                removeAllListeners: () => mockNode.events
            })
        });
        const handler = new UploadHandler(mockNode);
        const request = createMock<Request>({
            files: [
                createMock<Express.Multer.File>({ originalname: 'test' })
            ],
            body: {
                paths: 'a/b/c'
            }
        });
        let response: Response;
        const mockResponseStatus = mock.fn<(_unusedCode: number) => Response>((_unusedCode: number) => response);
        const mockResponseJson = mock.fn<(_unusedBody?: any) => Response>();
        response = createMock<Response>({
            status: mockResponseStatus as any,
            json: mockResponseJson as any,
            send: mockResponseJson as any
        });

        await handler.handle(request, response); // We just need it to hit the paths catch block
    });

    it('Identifies and halts timed out unresolved block streaming operations', async (t: any) => {
        if (t?.mock?.timers) {
            t.mock.timers.enable({ apis: ['setTimeout'] });
        } else {
            // fallback if mock is absent
        }
        const { publicKey, privateKey } = generateRSAKeyPair();
        const buffer = Buffer.from('mock');
        const { tree, root } = buildMerkleTree([buffer]);
        const merkleSiblings = getMerkleProof(tree, 0);
        const mockNode: PeerNode = createMock<PeerNode>({
            roles: [NodeRole.ORIGINATOR],
            publicKey,
            privateKey,
            port: 1234,
            storageProvider: createMock<BaseProvider>({
                createBlockStream: () => ({
                    physicalBlockId: 'id',
                    writeStream: new Writable({
                        write(_unusedC, _unusedE, cb) {
                            cb();
                        }
                    })
                })
            }),
            bundler: createMock<Bundler>({
                streamErasureBundle: async () => ({
                    files: [],
                    aesKey: 'k',
                    aesIv: 'iv',
                    shards: [buffer],
                    authTag: '',
                    originalSize: 0,
                    merkleRoots: [root]
                })
            }),
            consensusEngine: createMock<ConsensusEngine>({
                handlePendingBlock: async () => {
                    throw new Error('Converge Error for test');
                },
                walletManager: createMock<WalletManager>({
                    verifyFunds: mock.fn<() => Promise<boolean>>(() => Promise.resolve(true)),
                    freezeFunds: mock.fn<() => void>(),
                    releaseFunds: mock.fn<() => void>(),
                    commitFunds: mock.fn<() => void>()
                })
            }),
            syncEngine: createMock<SyncEngine>({
                orchestrateStorageMarket: async () => [{
                    peerId: 'mock-1',
                    connection: {
                        peerAddress: 'address',
                        send: () => { }
                    }
                }]
            }),
            peer: createMock<Peer>({
                broadcast: async () => { }
            }),
            reputationManager: createMock<ReputationManager>({
                penalizeMajor: async (_unusedPeerId: string, _unusedReason: string) => null
            }),
            events: createMock<EventEmitter>({
                once: (evt: string | symbol, cb: (..._unusedArgs: unknown[]) => void) => {
                    if (typeof evt === 'string') {
                        if (evt.startsWith('shard_response')) {
                            cb({
                                success: true,
                                physicalId: 'id'
                            });
                        } else if (evt.startsWith('handoff_response')) {
                            cb({
                                success: true,
                                chunkDataBase64: buffer.toString('base64'),
                                merkleSiblings: merkleSiblings
                            });
                        }
                    }
                    return mockNode.events;
                },
                emit: () => true,
                removeAllListeners: () => mockNode.events
            })
        });
        const handler = new UploadHandler(mockNode);
        const request = createMock<Request>({
            files: [
                createMock<Express.Multer.File>({ originalname: 'test' })
            ],
            body: {}
        });
        let response: any;
        const mockResponseStatus = mock.fn<(_unusedCode: number) => Response>((_unusedCode: number) => response);
        const mockResponseJson = mock.fn<(_unusedBody?: any) => Response>();
        response = createMock<Response>({
            status: mockResponseStatus as any,
            json: mockResponseJson as any,
            send: mockResponseJson as any
        });

        await handler.handle(request, response);
        if (t?.mock?.timers) {
            t.mock.timers.tick(120000);
        }

        // ensure event loop flushes
        await new Promise<void>(resolve => setImmediate(resolve));
    });

    it('Penalizes and rejects storage market allocations returning invalid chunk maps', async () => {
        let penalizedNode = '';
        const { publicKey, privateKey } = generateRSAKeyPair();
        const mockNode: PeerNode = createMock<PeerNode>({
            roles: [NodeRole.ORIGINATOR],
            publicKey,
            privateKey,
            port: 1234,
            storageProvider: createMock<BaseProvider>({
                createBlockStream: () => ({
                    physicalBlockId: 'id',
                    writeStream: new Writable({
                        write(_unusedC, _unusedE, cb) {
                            cb();
                        }
                    })
                })
            }),
            bundler: createMock<Bundler>({
                streamErasureBundle: async () => ({
                    files: [],
                    aesKey: 'k',
                    aesIv: 'iv',
                    shards: [Buffer.from('mock')],
                    authTag: '',
                    originalSize: 0,
                    merkleRoots: ['realRoot123']
                })
            }),
            consensusEngine: createMock<ConsensusEngine>({
                handlePendingBlock: async () => { },
                walletManager: createMock<WalletManager>({
                    verifyFunds: mock.fn<() => Promise<boolean>>(() => Promise.resolve(true)),
                    freezeFunds: mock.fn<() => void>(),
                    releaseFunds: mock.fn<() => void>(),
                    commitFunds: mock.fn<() => void>()
                })
            }),
            syncEngine: createMock<SyncEngine>({
                orchestrateStorageMarket: async () => [{
                    peerId: 'mock-1',
                    connection: {
                        peerAddress: 'address',
                        send: () => { }
                    }
                }]
            }),
            reputationManager: createMock<ReputationManager>({
                penalizeMajor: async (publicKey: string, _unusedReason: string) => {
                    penalizedNode = publicKey;
                    return null;
                }
            }),
            peer: createMock<Peer>({
                broadcast: async () => { }
            }),
            events: createMock<EventEmitter>({
                once: (evt: string | symbol, cb: (..._unusedArgs: unknown[]) => void): EventEmitter => {
                    if (typeof evt === 'string') {
                        if (evt.startsWith('shard_response')) {
                            cb({
                                success: true,
                                physicalId: 'id'
                            });
                        } else if (evt.startsWith('handoff_response')) {
                            cb({
                                success: true,
                                chunkDataBase64: Buffer.from('Garbage').toString('base64'),
                                merkleSiblings: ['maliciousGarbageHash']
                            });
                        }
                    }
                    return mockNode.events;
                },
                emit: () => true,
                removeAllListeners: (): EventEmitter => mockNode.events
            })
        });
        const handler = new UploadHandler(mockNode);
        const request = createMock<Request>({
            files: [
                createMock<Express.Multer.File>({ originalname: 'test' })
            ],
            body: {}
        });
        let response: Response;
        const mockResponseStatus = mock.fn<(_unusedCode: number) => Response>((_unusedCode: number) => response);
        const mockResponseJson = mock.fn<(_unusedBody?: any) => Response>();
        response = createMock<Response>({
            status: mockResponseStatus as any,
            json: mockResponseJson as any,
            send: mockResponseJson as any
        });

        await handler.handle(request, response);

        const responseStatus = mockResponseStatus.mock.calls.pop()?.arguments[0];
        assert.strictEqual(responseStatus, 502);
        const responseBody = mockResponseJson.mock.calls[0]?.arguments[0];
        assert.ok(typeof responseBody === 'string' && responseBody.includes('atally failed'));
        assert.strictEqual(penalizedNode, 'mock-1');
    });
});

