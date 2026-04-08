import * as fs from 'fs';

import logger from '../logger/Logger';
import { GlacierCredentials } from '../storage_providers/glacier_provider/GlacierProvider';
import { LocalCredentials } from '../storage_providers/local_provider/LocalProvider';
import { RemoteFSCredentials } from '../storage_providers/remote_fs_provider/RemoteFSProvider';
import { S3Credentials } from '../storage_providers/s3_provider/S3Provider';
import { SambaCredentials } from '../storage_providers/samba_provider/SambaProvider';

export interface KeyPaths {
    ringPublicKeyPath?: string;
    publicKeyPath?: string;
    privateKeyPath?: string;
    signaturePath?: string;
}

export interface PeerCredentials {
    ringPublicKey?: string;
    publicKey?: string;
    privateKey?: string;
    signature?: string;
    ringPublicKeyPath?: string;
    publicKeyPath?: string;
    privateKeyPath?: string;
    signaturePath?: string;
    evmPrivateKey?: string;
    evmPrivateKeyPath?: string;
}

export interface Credentials {
    peer?: PeerCredentials;
    local?: LocalCredentials;
    s3?: S3Credentials;
    glacier?: GlacierCredentials;
    samba?: SambaCredentials;
    "remote-fs"?: RemoteFSCredentials;
    github?: any;
    [key: string]: any;
}

/**
 * Resolves enterprise credentials prioritizing Host metadata (Env variables) 
 * over deprecated flat files statically.
 */
export class CredentialProvider {
    static resolve(): Credentials {
        let credentials: Credentials = {};

        // 1. Attempt dynamic injection from environment variables (Highest Priority)
        if (process.env.STORAGE_CREDS_ACTIVE === 'true' || process.env.S3_ACCESS_KEY || process.env.SFTP_PASSWORD || process.env.GITHUB_TOKEN || process.env.PEER_PRIVATE_KEY || process.env.PEER_PRIVATE_KEY_PATH) {
            logger.info("Resolving node and storage credentials via Host Environment Metadata.");
            return {
                s3: {
                    accessKey: process.env.S3_ACCESS_KEY!,
                    secretKey: process.env.S3_SECRET_KEY!,
                    region: process.env.S3_REGION || 'us-east-1',
                    bucket: process.env.S3_BUCKET!
                },
                glacier: {
                    accessKey: process.env.GLACIER_ACCESS_KEY!,
                    secretKey: process.env.GLACIER_SECRET_KEY!,
                    region: process.env.GLACIER_REGION || 'us-east-1',
                    vaultName: process.env.GLACIER_VAULT!
                },
                samba: {
                    share: process.env.SAMBA_SHARE!,
                    domain: process.env.SAMBA_DOMAIN!,
                    username: process.env.SAMBA_USERNAME!,
                    password: process.env.SAMBA_PASSWORD!
                },
                'remote-fs': {
                    host: process.env.SFTP_HOST!,
                    port: process.env.SFTP_PORT ? parseInt(process.env.SFTP_PORT, 10) : 22,
                    username: process.env.SFTP_USERNAME!,
                    password: process.env.SFTP_PASSWORD!
                },
                github: {
                    token: process.env.GITHUB_TOKEN!,
                    owner: process.env.GITHUB_OWNER!,
                    repo: process.env.GITHUB_REPO!,
                    branch: process.env.GITHUB_BRANCH || 'main'
                },
                peer: {
                    privateKey: process.env.PEER_PRIVATE_KEY,
                    publicKey: process.env.PEER_PUBLIC_KEY,
                    signature: process.env.PEER_SIGNATURE,
                    ringPublicKey: process.env.RING_PUBLIC_KEY,
                    privateKeyPath: process.env.PEER_PRIVATE_KEY_PATH,
                    publicKeyPath: process.env.PEER_PUBLIC_KEY_PATH,
                    signaturePath: process.env.PEER_SIGNATURE_PATH,
                    ringPublicKeyPath: process.env.RING_PUBLIC_KEY_PATH,
                    evmPrivateKey: process.env.PEER_EVM_PRIVATE_KEY,
                    evmPrivateKeyPath: process.env.PEER_EVM_PRIVATE_KEY_PATH
                }
            } as Credentials;
        }

        // 2. Fallback strictly to legacy JSON definitions (Deprecated)
        if (fs.existsSync('credentials.json')) {
            try {
                logger.warn("WARNING: Utilizing flat-file credentials.json mapping. Consider migrating to Environment variables for enhanced security.");
                credentials = JSON.parse(fs.readFileSync('credentials.json', 'utf8'));
            } catch (err: any) {
                logger.error("Error parsing credentials.json:", err.message);
            }
        }

        return credentials;
    }
}
