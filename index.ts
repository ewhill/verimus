import Bundler from './bundler';
import PeerNode from './peerNode';
import * as fs from 'fs';
import logger from './logger';
import { Credentials, PeerCredentials } from './credentialProvider';
import { RemoteFSCredentials } from './storage_providers/remoteFSProvider/remoteFSProvider';
import { S3Credentials } from './storage_providers/s3Provider/s3Provider';
import { LocalCredentials } from './storage_providers/localProvider/localProvider';
import { SambaCredentials } from './storage_providers/sambaProvider/sambaProvider';
import { GlacierCredentials } from './storage_providers/glacierProvider/glacierProvider';
import BaseStorageProvider from './storage_providers/baseProvider';
import S3StorageProvider from './storage_providers/s3Provider/s3Provider';
import GlacierStorageProvider from './storage_providers/glacierProvider/glacierProvider';
import SambaStorageProvider from './storage_providers/sambaProvider/sambaProvider';
import RemoteFSStorageProvider from './storage_providers/remoteFSProvider/remoteFSProvider';
import LocalStorageProvider from './storage_providers/localProvider/localProvider';
import GithubStorageProvider from './storage_providers/githubProvider/githubProvider';
import MemoryStorageProvider from './storage_providers/memoryProvider/memoryProvider';
import { CredentialProvider } from './credentialProvider';


async function main() {
    logger.info("Starting Verimus Secure Storage Node...");

    // Parse CLI arguments for MongoDB and Storage
    let mongoHost = '127.0.0.1';
    let mongoPort = '27017';
    let storageType = 'local';
    let port = 26780;
    let discoverAddresses = ['127.0.0.1:26781'];
    let publicAddress: string | undefined;
    let ringPublicKeyPath: string | undefined;
    let publicKeyPath: string | undefined;
    let privateKeyPath: string | undefined;
    let signaturePath: string | undefined;
    let dataDir = './data';
    let isHeadless = false;

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
        } else if (arg === '--ring-public-key-path' && i + 1 < process.argv.length) {
            ringPublicKeyPath = process.argv[++i];
        } else if (arg === '--public-key-path' && i + 1 < process.argv.length) {
            publicKeyPath = process.argv[++i];
        } else if (arg === '--private-key-path' && i + 1 < process.argv.length) {
            privateKeyPath = process.argv[++i];
        } else if (arg === '--signature-path' && i + 1 < process.argv.length) {
            signaturePath = process.argv[++i];
        } else if (arg === '--data-dir' && i + 1 < process.argv.length) {
            dataDir = process.argv[++i];
        }
    }
    const mongoUri = `mongodb://${mongoHost}:${mongoPort}`;
    logger.info(`Configured MongoDB URI: ${mongoUri}`);

    // Resolve credentials securely mapping environments
    const credentials = CredentialProvider.resolve();

    // Setup Storage Provider dynamically
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
            const p = GithubStorageProvider.parseArgs(process.argv, providerCreds as any);
            if (!p) throw new Error("Missing GitHub credentials or args.");
            storageProvider = p;
            break;
        }
        case 'memory':
            storageProvider = MemoryStorageProvider.parseArgs(process.argv, providerCreds as any);
            break;
        case 'local':
        default:
            storageProvider = LocalStorageProvider.parseArgs(process.argv, providerCreds as LocalCredentials);
            break;
    }

    // Waiting for files to be uploaded via UI now.
    const bundler = new Bundler(dataDir);

    const keyPaths: PeerCredentials = {
        ringPublicKey: credentials.peer?.ringPublicKey,
        publicKey: credentials.peer?.publicKey,
        privateKey: credentials.peer?.privateKey,
        signature: credentials.peer?.signature,
        ringPublicKeyPath: credentials.peer?.ringPublicKeyPath || ringPublicKeyPath,
        publicKeyPath: credentials.peer?.publicKeyPath || publicKeyPath,
        privateKeyPath: credentials.peer?.privateKeyPath || privateKeyPath,
        signaturePath: credentials.peer?.signaturePath || signaturePath,
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
        isHeadless
    );
    await node1.init();

    logger.info(`Process complete. Node listening on https://localhost:${port}`);
}

main().catch(e => console.error("Unhandled Error in main:", e));
