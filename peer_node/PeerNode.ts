import EventEmitter from 'events';
import * as fs from 'fs';
import { IncomingMessage } from 'http';
// import { Http2ServerRequest } from 'http2';
import * as https from 'https';
import { Socket } from 'net';


import { ethers } from 'ethers';
import { Db } from 'mongodb';
import { WebSocket } from 'ws';

import setupExpressApp from '../api_server/ApiServer';
import Bundler from '../bundler/Bundler';
import { BLOCK_TYPES, GENESIS_SEED_DATA, IS_DEV_NETWORK } from '../constants';
import { EIP712_DOMAIN, EIP712_SCHEMAS, normalizeBlockForSignature } from '../crypto_utils/EIP712Types';
import { PeerCredentials } from '../credential_provider/CredentialProvider';
import Ledger from '../ledger/Ledger';
import logger from '../logger/Logger';
import Mempool from '../models/mempool/Mempool';
import { Peer } from '../p2p';
import Server from '../p2p/lib/Server';
import ConsensusEngine from '../peer_handlers/consensus_engine/ConsensusEngine';
import GarbageCollector from '../peer_handlers/garbage_collector/GarbageCollector';
import { ReputationManager } from '../peer_handlers/reputation_manager/ReputationManager';
import SyncEngine from '../peer_handlers/sync_engine/SyncEngine';
import BaseProvider from '../storage_providers/base_provider/BaseProvider';
import { Block } from '../types';
import { NodeRole } from '../types/NodeRole';
import WalletManager from '../wallet_manager/WalletManager';



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
    garbageCollector: GarbageCollector;
    reputationManager!: ReputationManager;
    events: EventEmitter;
    walletAddress!: string;
    wallet!: ethers.Wallet | ethers.HDNodeWallet;
    walletManager!: WalletManager;
    httpServer?: https.Server;
    isHeadless: boolean;
    _publicKeyOverride?: string;

    get publicKey(): string {
        return this._publicKeyOverride || this.walletAddress;
    }

    set publicKey(val: string) {
        this._publicKeyOverride = val;
    }

    roles: NodeRole[];
    proxyBrokerFee: number;
    constructor(port: number, discoverAddresses: string[] = [], storageProvider: BaseProvider | null = null, bundler: Bundler | null = null, mongoUri: string | null = null, publicAddress: string | null = null, keyPaths: PeerCredentials, dataDir: string | null = null, isHeadless: boolean = false, roles: NodeRole[] = [NodeRole.ORIGINATOR, NodeRole.VALIDATOR, NodeRole.STORAGE], proxyBrokerFee: number = 0.01) {
        this.port = port;
        this.discoverAddresses = discoverAddresses;
        this.publicAddress = publicAddress;
        this.ledger = mongoUri ? new Ledger(mongoUri) : new Ledger();
        this.peer = null;
        this.isHeadless = isHeadless;
        this.roles = roles;
        this.proxyBrokerFee = proxyBrokerFee;
        this.storageProvider = storageProvider;
        this.bundler = bundler;
        this.keyPaths = {
            ...keyPaths,
            privateKeyPath: keyPaths.privateKeyPath || `keys/peer_${this.port}.peer.pem`,
            evmPrivateKeyPath: keyPaths.evmPrivateKeyPath || `keys/peer_${this.port}.evm.key`
        };

        this.mempool = new Mempool();


        this.publicAddress = publicAddress || `${port}`;

        this.dataDir = dataDir || 'data';
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        this.db = null;
        this.ownedBlocksCache = [];

        this.events = new EventEmitter();
        this.consensusEngine = new ConsensusEngine(this);
        this.syncEngine = new SyncEngine(this);
        this.garbageCollector = new GarbageCollector(this);
    }

    async init() {
        await this.ledger.init(this.port);

        this.walletManager = new WalletManager(this.ledger);

        this.reputationManager = new ReputationManager(this.ledger.peersCollection);

        this.reputationManager.on('banned', async (walletAddress: string) => {
            if (this.peer && this.peer.peers) {
                // Find and disconnect the banned peer
                const bannedClient = this.peer.peers.find((p: any) => p.remoteCredentials_?.walletAddress?.toLowerCase() === walletAddress.toLowerCase());
                if (bannedClient && typeof bannedClient.close === 'function') {
                    logger.warn(`[Peer ${this.port}] terminating network pipeline for banned peer ${bannedClient.peerAddress}`);
                    bannedClient.close();
                } else if (bannedClient && bannedClient.connection_ && typeof bannedClient.connection_.close === 'function') {
                    logger.warn(`[Peer ${this.port}] terminating physical socket bounds for banned peer ${bannedClient.peerAddress}`);
                    bannedClient.connection_.close();
                }
            }

            try {
                // If a peer is banned, we structurally trigger an internal proof of stake slashing sequence 
                if (this.roles.includes(NodeRole.VALIDATOR)) {
                    const slashStr = JSON.stringify({ penalizedAddress: walletAddress, evidenceSignature: "SYSTEM_BANNED", burntAmount: Number(ethers.parseUnits("100", 18)) });
                    const slashSig = await this.wallet.signMessage(slashStr);
                    const slashBlock: import('../types').Block = {
                        metadata: { index: -1, timestamp: Date.now() },
                        type: 'SLASHING_TRANSACTION',
                        payload: { penalizedAddress: walletAddress, evidenceSignature: "SYSTEM_BANNED", burntAmount: ethers.parseUnits("100", 18) },
                        signerAddress: this.walletAddress,
                        signature: slashSig
                    };
                    await this.consensusEngine.handlePendingBlock(slashBlock, { peerAddress: `127.0.0.1:${this.port}` } as any, Date.now());
                    logger.warn(`[Peer ${this.port}] Issued localized SLASHING_TRANSACTION against BANNED entity ${walletAddress.substring(0, 16)}...`);
                }
            } catch (err: any) {
                logger.error(`[Peer ${this.port}] Failed emitting SLASHING_TRANSACTION autonomously: ${err.message}`);
            }
        });

        // Dynamically instantiate backend EVM wallet address explicitly used purely for checkpoint and systemic signing 
        if (this.keyPaths.evmPrivateKey) {
            this.wallet = new ethers.Wallet(this.keyPaths.evmPrivateKey);
        } else if (this.keyPaths.evmPrivateKeyPath && fs.existsSync(this.keyPaths.evmPrivateKeyPath)) {
            const pk = fs.readFileSync(this.keyPaths.evmPrivateKeyPath, 'utf8').trim();
            this.wallet = new ethers.Wallet(pk);
        } else {
            this.wallet = ethers.Wallet.createRandom();
        }
        this.walletAddress = this.wallet.address;
        
        // Propagate initialized wallet natively mapping explicitly down to P2P peer instance internally smoothly securely securely explicitly seamlessly.
        if (this.peer) {
            (this.peer as any).walletAddress_ = this.walletAddress;
        }

        // Setup Express API Server
        await this.loadOwnedBlocksCache();
        this.ledger.events.on('blockAdded', (b) => this.addOwnedBlockToCache(b));

        const app = setupExpressApp(this);

        const httpsKeyPath = this.keyPaths.httpsKeyPath || 'https.key.pem';
        const httpsCertPath = this.keyPaths.httpsCertPath || 'https.cert.pem';

        const httpServer = https.createServer({
            key: fs.readFileSync(httpsKeyPath),
            cert: fs.readFileSync(httpsCertPath)
        }, app);

        const discoveryAddrs = this.discoverAddresses.filter(addr => addr !== `127.0.0.1:${this.port}` && addr !== this.publicAddress);

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
            evmPrivateKey: this.wallet.privateKey,
            walletAddress: this.walletAddress
        });

        httpServer.on('upgrade', (request: IncomingMessage, socket: Socket, head: any) => {
            if (this.peer && this.peer.wsServer) {
                this.peer.wsServer.handleUpgrade(request, socket, head, (client: WebSocket) => {
                    this.peer!.wsServer!.emit('connection', client, request);
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
                    let remoteIdentity = connection.remoteCredentials_?.walletAddress || connection.remoteCredentials_?.rsaKeyPair?.public?.toString('utf8');
                    if (remoteIdentity) {
                        const isBanned = await this.reputationManager.isBanned(remoteIdentity);
                        if (isBanned) {
                            logger.warn(`[Peer ${this.port}] Dropping packet from banned peer ${connection.peerAddress}`);
                            return;
                        }
                    }
                    return originalOnClientMessage(connection, type, message);
                };

                if (discoveryAddrs.length > 0) {
                    logger.info(`[Peer ${this.port}] Discovering ${discoveryAddrs.join(', ')}...`);
                    await this.peer!.discover();
                    setTimeout(() => {
                        this.syncEngine.performInitialSync().catch(err => logger.warn(`[Peer ${this.port}] Initial Sync Exception ignored: ${err.message}`));
                    }, 5000);
                } else {
                    logger.info(`[Peer ${this.port}] Genesis node detected (no discovery topology). Initialized.`);
                    this.syncEngine.performInitialSync().catch(err => logger.warn(`[Peer ${this.port}] Genesis Sync Exception ignored: ${err.message}`));
                }

                // --- Phase 1 Genesis Bootstrapping ---
                try {
                    if (this.storageProvider) {
                        const genContract = await this.ledger.getBlockByIndex(1);
                        if (genContract && genContract.type === 'STORAGE_CONTRACT') {
                            // Map physical boundaries strictly matching the true inner mapping bounds avoiding block ID mismatches gracefully securely
                            const innerPhysicalId = (genContract.payload as any)?.fragmentMap?.[0]?.physicalId || 'GENESIS_PHYSICAL_ID';
                            await this.storageProvider.storeShard(innerPhysicalId, GENESIS_SEED_DATA);

                            logger.info(`[Peer ${this.port}] Synchronized and physicalized Genesis seed mapping ${innerPhysicalId.slice(0, 8)} natively!`);
                        }
                    }

                    // --- Phase 6: Originator Staking Boot Sequence ---
                    if (this.roles.includes(NodeRole.ORIGINATOR) && !IS_DEV_NETWORK) {
                        try {
                            const stakingBlock: Block = {
                                metadata: { index: -1, timestamp: Date.now() },
                                type: 'STAKING_CONTRACT',
                                payload: { operatorAddress: this.walletAddress, collateralAmount: ethers.parseUnits("50000", 18), minEpochTimelineDays: 30n },
                                signerAddress: this.walletAddress,
                                signature: ''
                            };
                            const valueObj = normalizeBlockForSignature(stakingBlock);
                            const schema = EIP712_SCHEMAS['STAKING_CONTRACT'];
                            stakingBlock.signature = await this.wallet.signTypedData(EIP712_DOMAIN, schema, valueObj.payload ? valueObj : valueObj);
                            await this.consensusEngine.handlePendingBlock(stakingBlock, { peerAddress: `127.0.0.1:${this.port}` } as any, Date.now());
                        } catch (err: any) {
                            logger.warn(`[Peer ${this.port}] Failed to emit initial Proof-of-Stake STAKING_CONTRACT dynamically: ${err.message}`);
                        }
                    }

                    // --- Phase 7: Validator Registry Boot Sequence ---
                    if (this.roles.includes(NodeRole.VALIDATOR) && !IS_DEV_NETWORK) {
                        try {
                            const valBlock: Block = {
                                metadata: { index: -1, timestamp: Date.now() },
                                type: 'VALIDATOR_REGISTRATION',
                                payload: { validatorAddress: this.walletAddress, stakeAmount: ethers.parseUnits("1000", 18), action: 'STAKE' },
                                signerAddress: this.walletAddress,
                                signature: ''
                            };
                            const valValueObj = normalizeBlockForSignature(valBlock);
                            const valSchema = EIP712_SCHEMAS['VALIDATOR_REGISTRATION'];
                            valBlock.signature = await this.wallet.signTypedData(EIP712_DOMAIN, valSchema, valValueObj.payload ? valValueObj : valValueObj);
                            await this.consensusEngine.handlePendingBlock(valBlock, { peerAddress: `127.0.0.1:${this.port}` } as any, Date.now());
                        } catch (err: any) {
                            logger.warn(`[Peer ${this.port}] Failed to emit initial VALIDATOR_REGISTRATION dynamically: ${err.message}`);
                        }
                    }
                } catch (_unusedE: any) {
                    logger.warn(`[Peer ${this.port}] Genesis Seed formulation dynamically skipped explicitly mapping safe execution limit constraints.`);
                }

                resolve();
            });
        });
    }

    stop() {
        this.consensusEngine.stop();
        if (this.syncEngine && typeof (this.syncEngine as any).stop === 'function') {
            (this.syncEngine as any).stop();
        }
        if (this.httpServer) {
            this.httpServer.close();
        }
        if (this.peer && typeof this.peer.close === 'function') {
            this.peer.close();
        }
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
                // Initial migration or recovery: fetch all owned blocks from main collection and index them
                const blocks = await this.ledger.collection!.find({ signerAddress: this.walletAddress }).toArray();
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
            logger.error(`[Peer ${this.port}] Error loading owned blocks cache: ${e.message}`);
            this.ownedBlocksCache = [];
        }
    }

    async addOwnedBlockToCache(block: Block) {
        // Verify no pending blocks conflict correctly hashing mapped boundaries physically!
        if (block.signature && this.mempool) {
            if (this.mempool.pendingBlocks) {
                // If a pending block with the same signature exists, we accurately delete it
                // since the block was structurally adopted into the chain natively.
                for (const [pId, pEntry] of this.mempool.pendingBlocks.entries()) {
                    if (pEntry.block.signature === block.signature) {
                        pEntry.committed = true;
                        this.mempool.pendingBlocks.delete(pId);
                        break;
                    }
                }
            }
        }

        if (block.signerAddress === this.walletAddress && !this.ownedBlocksCache.includes(block.hash!)) {
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
        const activeValidators = this.ledger.activeValidatorCountCache;
        // In local mock tests or very early genesis spins where validation caching is 0, default strictly to 1 safely
        const totalNodes = activeValidators > 0 ? activeValidators : 1;
        return Math.floor(totalNodes / 2) + 1;
    }
}

export default PeerNode;
