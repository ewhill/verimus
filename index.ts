import Bundler from './bundler/Bundler';
import { Credentials, PeerCredentials } from './credential_provider/CredentialProvider';
import { CredentialProvider } from './credential_provider/CredentialProvider';
import logger from './logger/Logger';
import PeerNode from './peer_node/PeerNode';
import BaseStorageProvider from './storage_providers/base_provider/BaseProvider';
import GithubStorageProvider, { GithubCredentials } from './storage_providers/github_provider/GithubProvider';
import { GlacierCredentials } from './storage_providers/glacier_provider/GlacierProvider';
import GlacierStorageProvider from './storage_providers/glacier_provider/GlacierProvider';
import { LocalCredentials } from './storage_providers/local_provider/LocalProvider';
import LocalStorageProvider from './storage_providers/local_provider/LocalProvider';
import MemoryStorageProvider from './storage_providers/memory_provider/MemoryProvider';
import { RemoteFSCredentials } from './storage_providers/remote_fs_provider/RemoteFSProvider';
import RemoteFSStorageProvider from './storage_providers/remote_fs_provider/RemoteFSProvider';
import { S3Credentials } from './storage_providers/s3_provider/S3Provider';
import S3StorageProvider from './storage_providers/s3_provider/S3Provider';
import { SambaCredentials } from './storage_providers/samba_provider/SambaProvider';
import SambaStorageProvider from './storage_providers/samba_provider/SambaProvider';
import { NodeRole } from './types/NodeRole';

async function main() {
    // Inject BigInt serialization mapping seamlessly globally
    // @ts-ignore
    BigInt.prototype.toJSON = function() { return this.toString(); };

    logger.info("Starting Verimus Secure Storage Node...");

    // Parse CLI arguments for MongoDB and Storage
    let mongoHost = '127.0.0.1';
    let mongoPort = '27017';
    let storageType = 'local';
    let port = 26780;
    let discoverAddresses = ['127.0.0.1:26781'];
    let publicAddress: string | undefined;
    let publicKeyPath: string | undefined;
    let privateKeyPath: string | undefined;
    let evmPrivateKeyPath: string | undefined;
    let httpsKeyPath: string | undefined;
    let httpsCertPath: string | undefined;
    let dataDir = './data';
    let isHeadless = false;
    let roles: NodeRole[] = [NodeRole.ORIGINATOR, NodeRole.VALIDATOR, NodeRole.STORAGE];

    for (let i = 2; i < process.argv.length; i++) {
        const arg = process.argv[i];
        if (arg === '--headless') {
            isHeadless = true;
        } else if (arg === '--mongo-host' && i + 1 < process.argv.length) {
            mongoHost = process.argv[++i];
        } else if (arg === '--mongo-port' && i + 1 < process.argv.length) {
            mongoPort = process.argv[++i];
        } else if (arg === '--storage-type' && i + 1 < process.argv.length) {
            storageType = process.argv[++i];
        } else if (arg === '--port' && i + 1 < process.argv.length) {
            port = parseInt(process.argv[++i], 10);
        } else if (arg === '--discover' && i + 1 < process.argv.length) {
            discoverAddresses = process.argv[++i].split(',').map(addr => {
                addr = addr.trim();
                return /^\d+$/.test(addr) ? `127.0.0.1:${addr}` : addr;
            });
        } else if (arg === '--public-address' && i + 1 < process.argv.length) {
            publicAddress = process.argv[++i];
        } else if (arg === '--public-key-path' && i + 1 < process.argv.length) {
            publicKeyPath = process.argv[++i];
        } else if (arg === '--private-key-path' && i + 1 < process.argv.length) {
            privateKeyPath = process.argv[++i];
        } else if (arg === '--evm-private-key-path' && i + 1 < process.argv.length) {
            evmPrivateKeyPath = process.argv[++i];
        } else if (arg === '--https-key-path' && i + 1 < process.argv.length) {
            httpsKeyPath = process.argv[++i];
        } else if (arg === '--https-cert-path' && i + 1 < process.argv.length) {
            httpsCertPath = process.argv[++i];
        } else if (arg === '--data-dir' && i + 1 < process.argv.length) {
            dataDir = process.argv[++i];
        } else if (arg === '--roles' && i + 1 < process.argv.length) {
            roles = process.argv[++i].split(',').map(r => r.trim().toUpperCase() as NodeRole);
        }
    }
    const mongoUri = `mongodb://${mongoHost}:${mongoPort}`;
    logger.info(`Configured MongoDB URI: ${mongoUri}`);

    // Resolve credentials mapping environments
    const credentials = CredentialProvider.resolve();

    // Setup Storage Provider
    let storageProvider: BaseStorageProvider;
    const providerCreds = credentials[storageType.toLowerCase() as keyof Credentials];

    switch (storageType.toLowerCase()) {
        case 's3':
            storageProvider = S3StorageProvider.parseArgs(process.argv, providerCreds as S3Credentials);
            break;
        case 'glacier':
            storageProvider = GlacierStorageProvider.parseArgs(process.argv, providerCreds as GlacierCredentials);
            break;
        case 'samba':
            storageProvider = SambaStorageProvider.parseArgs(process.argv, providerCreds as SambaCredentials);
            break;
        case 'remote-fs':
            storageProvider = RemoteFSStorageProvider.parseArgs(process.argv, providerCreds as RemoteFSCredentials);
            break;
        case 'github': {
            const p = GithubStorageProvider.parseArgs(process.argv, providerCreds as GithubCredentials);
            if (!p) throw new Error("Missing GitHub credentials or args.");
            storageProvider = p;
            break;
        }
        case 'memory':
            storageProvider = MemoryStorageProvider.parseArgs(process.argv, providerCreds as Record<string, unknown>);
            break;
        case 'local':
        default:
            storageProvider = LocalStorageProvider.parseArgs(process.argv, providerCreds as LocalCredentials);
            break;
    }

    // Waiting for files to be uploaded via UI now.
    const bundler = new Bundler(dataDir);

    const keyPaths: PeerCredentials = {
        publicKey: credentials.peer?.publicKey,
        privateKey: credentials.peer?.privateKey,
        publicKeyPath: credentials.peer?.publicKeyPath || publicKeyPath,
        privateKeyPath: credentials.peer?.privateKeyPath || privateKeyPath,
        evmPrivateKeyPath: credentials.peer?.evmPrivateKeyPath || evmPrivateKeyPath,
        httpsKeyPath: credentials.peer?.httpsKeyPath || httpsKeyPath,
        httpsCertPath: credentials.peer?.httpsCertPath || httpsCertPath,
    };

    // Initialize Node
    const node1 = new PeerNode(
        port,
        discoverAddresses,
        storageProvider,
        bundler,
        mongoUri,
        publicAddress,
        keyPaths,
        dataDir,
        isHeadless,
        roles
    );
    await node1.init();

    logger.info(`Process complete. Node listening on https://localhost:${port}`);
}

main().catch(e => console.error("Unhandled Error in main:", e));
