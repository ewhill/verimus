import EventEmitter from 'events';
import Server from 'ringnet/lib/server';
import * as https from 'https';
import { Peer } from 'ringnet';
import { Db } from 'mongodb';
import { Socket } from 'net';
import { Http2ServerRequest } from 'http2';
import * as fs from 'fs';

import Ledger from '../ledger/Ledger';
import BaseProvider from '../storage_providers/base_provider/BaseProvider';
import { Block } from '../types';
import { PeerCredentials } from '../credential_provider/CredentialProvider';
import Bundler from '../bundler/Bundler';
import Mempool from '../models/mempool/Mempool';
import ConsensusEngine from '../peer_handlers/consensus_engine/ConsensusEngine';
import SyncEngine from '../peer_handlers/sync_engine/SyncEngine';
import { ReputationManager } from '../peer_handlers/reputation_manager/ReputationManager';
import setupExpressApp from '../api_server/ApiServer';
import logger from '../logger/Logger';

class PeerNode {
    port: number;
    discoverAddresses: string[];
    publicAddress: string | null;
    ledger: Ledger;
    peer: Peer | null;
    storageProvider: BaseProvider | null;
    bundler: Bundler | null;
    keyPaths: PeerCredentials;
    mempool: Mempool;
    dataDir: string;
    db: Db | null;
    ownedBlocksCache: string[];
    consensusEngine: ConsensusEngine;
    syncEngine: SyncEngine;
    reputationManager!: ReputationManager;
    events: EventEmitter;
    publicKey!: string;
    privateKey!: string;
    signature!: string;
    httpServer?: https.Server;
    isHeadless: boolean;
    constructor(port: number, discoverAddresses: string[] = [], storageProvider: BaseProvider | null = null, bundler: Bundler | null = null, mongoUri: string | null = null, publicAddress: string | null = null, keyPaths: PeerCredentials, dataDir: string | null = null, isHeadless: boolean = false) {
        this.port = port;
        this.discoverAddresses = discoverAddresses;
        this.publicAddress = publicAddress;
        this.ledger = mongoUri ? new Ledger(mongoUri) : new Ledger();
        this.peer = null;
        this.isHeadless = isHeadless;
        this.storageProvider = storageProvider;
        this.bundler = bundler;
        this.keyPaths = {
            ...keyPaths,
            ringPublicKeyPath: keyPaths.ringPublicKeyPath || 'keys/ring.ring.pub',
            publicKeyPath: keyPaths.publicKeyPath || `keys/peer_${this.port}.peer.pub`,
            privateKeyPath: keyPaths.privateKeyPath || `keys/peer_${this.port}.peer.pem`,
            signaturePath: keyPaths.signaturePath || `keys/peer_${this.port}.peer.signature`
        };

        this.mempool = new Mempool();


        this.publicAddress = publicAddress || `${port}`;

        this.dataDir = dataDir || 'data';
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        this.db = null;
        this.ownedBlocksCache = [];

        this.consensusEngine = new ConsensusEngine(this);
        this.syncEngine = new SyncEngine(this);
        this.events = new EventEmitter();
    }

    async init() {
        await this.ledger.init(this.port);

        this.reputationManager = new ReputationManager(this.ledger.peersCollection);

        this.reputationManager.on('banned', (pubKey: string) => {
            if (this.peer && this.peer.peers) {
                // Find and disconnect the banned peer actively
                const bannedClient = this.peer.peers.find((p: any) => p.remoteCredentials_?.rsaKeyPair?.public?.toString('utf8') === pubKey);
                if (bannedClient && typeof bannedClient.close === 'function') {
                    logger.warn(`[Peer ${this.port}] Actively terminating network pipeline for banned peer ${bannedClient.peerAddress}`);
                    bannedClient.close();
                } else if (bannedClient && bannedClient.connection_ && typeof bannedClient.connection_.close === 'function') {
                    logger.warn(`[Peer ${this.port}] Actively terminating physical socket bounds for banned peer ${bannedClient.peerAddress}`);
                    bannedClient.connection_.close();
                }
            }
        });

        this.publicKey = this.keyPaths.publicKey || fs.readFileSync(this.keyPaths.publicKeyPath!, 'utf8');
        this.privateKey = this.keyPaths.privateKey || fs.readFileSync(this.keyPaths.privateKeyPath!, 'utf8');
        this.signature = this.keyPaths.signature || fs.readFileSync(this.keyPaths.signaturePath!, 'utf8');

        // Setup Express API Server
        await this.loadOwnedBlocksCache();
        this.ledger.events.on('blockAdded', (b) => this.addOwnedBlockToCache(b));

        const app = setupExpressApp(this);

        const httpServer = https.createServer({
            key: fs.readFileSync('myHttpsServer.key.pem'),
            cert: fs.readFileSync('myHttpsServer.cert.pem')
        }, app);

        const discoveryAddrs = this.discoverAddresses.filter(addr => addr !== `127.0.0.1:${this.port}`);

        this.peer = new Peer({
            discoveryConfig: {
                addresses: discoveryAddrs,
                range: { start: this.port, end: this.port }
            } as any,
            httpsServerConfig: {
                mode: Server.MODES.PASS,
                server: httpServer,
                port: this.port
            },
            wsServerConfig: {
                noServer: true
            },
            publicAddress: this.publicAddress || undefined,
            ringPublicKeyPath: this.keyPaths.ringPublicKeyPath,
            publicKeyPath: this.keyPaths.publicKeyPath,
            privateKeyPath: this.keyPaths.privateKeyPath,
            signaturePath: this.keyPaths.signaturePath,
            ringPublicKey: this.keyPaths.ringPublicKey,
            publicKey: this.keyPaths.publicKey,
            privateKey: this.keyPaths.privateKey,
            signature: this.keyPaths.signature
        });

        httpServer.on('upgrade', (request: Http2ServerRequest, socket: Socket, head: any) => {
            if (this.peer && this.peer.wsServer) {
                this.peer.wsServer.handleUpgrade(request, socket, head, (ws: WebSocket) => {
                    this.peer!.wsServer.emit('connection', ws, request);
                });
            }
        });

        this.httpServer = httpServer;

        this.syncEngine.bindHandlers();
        this.consensusEngine.bindHandlers();

        await new Promise<void>((resolve) => {
            httpServer.listen(this.port, '0.0.0.0', async () => {
                logger.info(`[Peer ${this.port}] HTTPS Server Listening on ${this.port}`);
                await this.peer!.init();

                // Inject Banishment Filtering (Early Return)
                // @ts-ignore
                const originalOnClientMessage = this.peer!.onClientMessage.bind(this.peer);
                // @ts-ignore
                this.peer!.onClientMessage = async (connection: any, type: string, message: any) => {
                    let remotePubKey = connection.remoteCredentials_?.rsaKeyPair?.public?.toString('utf8');
                    if (remotePubKey) {
                        const isBanned = await this.reputationManager.isBanned(remotePubKey);
                        if (isBanned) {
                            logger.warn(`[Peer ${this.port}] Dropping packet natively from banned peer ${connection.peerAddress}`);
                            return;
                        }
                    }
                    return originalOnClientMessage(connection, type, message);
                };

                if (discoveryAddrs.length > 0) {
                    logger.info(`[Peer ${this.port}] Discovering ${discoveryAddrs.join(', ')}...`);
                    await this.peer!.discover();
                    setTimeout(() => {
                        this.syncEngine.performInitialSync().catch(err => logger.warn(`[Peer ${this.port}] Initial Sync Exception safely ignored: ${err.message}`));
                    }, 5000);
                } else {
                    logger.info(`[Peer ${this.port}] Genesis node detected (no discovery topology). Initialized safely.`);
                }
                
                resolve();
            });
        });
    }

    async loadOwnedBlocksCache() {
        try {
            const dbBlockCount = await this.ledger.collection!.countDocuments();
            const ownedDocsCount = await this.ledger.ownedBlocksCollection!.countDocuments();

            if (dbBlockCount <= 1 && ownedDocsCount > 0) {
                logger.warn(`[Peer ${this.port}] Database appears purged but MongoDB owned blocks remain. Auto-invalidating stale cache.`);
                await this.ledger.ownedBlocksCollection!.deleteMany({});
                this.ownedBlocksCache = [];
                return;
            }

            if (ownedDocsCount === 0 && dbBlockCount > 1) {
                // Initial migration or recovery: fetch all owned blocks from main collection and index them natively
                const blocks = await this.ledger.collection!.find({ publicKey: this.publicKey }).toArray();
                this.ownedBlocksCache = blocks.map(b => b.hash!);
                
                if (this.ownedBlocksCache.length > 0) {
                    await this.ledger.ownedBlocksCollection!.insertMany(
                        this.ownedBlocksCache.map(hash => ({ hash }))
                    );
                }
                logger.info(`[Peer ${this.port}] Recovered owned blocks cache (${this.ownedBlocksCache.length} blocks)`);
            } else {
                const ownedDocs = await this.ledger.ownedBlocksCollection!.find({}).toArray();
                this.ownedBlocksCache = ownedDocs.map(doc => doc.hash);
                logger.info(`[Peer ${this.port}] Loaded ${this.ownedBlocksCache.length} owned blocks from MongoDB`);
            }
        } catch (e: any) {
            logger.error(`[Peer ${this.port}] Error loading owned blocks cache natively: ${e.message}`);
            this.ownedBlocksCache = [];
        }
    }

    async addOwnedBlockToCache(block: Block) {
        // Verify no pending blocks conflict
        const blockExistsInMempool = this.mempool.pendingBlocks.has(block.hash!);
        if (blockExistsInMempool) {
            // If a pending block with the same hash exists, it means this block was just processed
            // and is now being added to the ledger. We should remove it from pending.
            this.mempool.pendingBlocks.delete(block.hash!);
        }

        if (block.publicKey === this.publicKey && !this.ownedBlocksCache.includes(block.hash!)) {
            this.ownedBlocksCache.push(block.hash!);
            try {
                await this.ledger.ownedBlocksCollection!.insertOne({ hash: block.hash! });
                logger.info(`[Peer ${this.port}] Added block ${block.hash!.substring(0, 8)} to owned blocks collection`);
            } catch (e: any) {
                logger.error(`[Peer ${this.port}] Error saving owned block to MongoDB: ${e.message}`);
            }
        }
    }

    getMajorityCount() {
        const totalNodes = (this.peer && this.peer.trustedPeers ? this.peer.trustedPeers.length : 0) + 1;
        return Math.floor(totalNodes / 2) + 1;
    }
}

export default PeerNode;
