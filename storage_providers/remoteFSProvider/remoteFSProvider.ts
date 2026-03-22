import SftpClient from 'ssh2-sftp-client';
import logger from '../../logger';
import BaseStorageProvider, { GetBlockReadStreamResult } from '../baseProvider';
import crypto from 'crypto';
import { PassThrough } from 'stream';

export interface RemoteFSCredentials {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    remoteDir?: string;
}

class RemoteFSStorageProvider extends BaseStorageProvider {
    config: RemoteFSCredentials;
    remoteDir: string;

    constructor(host: string, port: number, username: string, password: string, remoteDir: string) {
        super();
        this.config = {
            host,
            port,
            username,
            password
        };
        this.remoteDir = remoteDir;
        logger.info(`[RemoteFSStorageProvider] Initialized for ${username}@${host}:${remoteDir}`);
    }

    getLocation() {
        return {
            type: 'remote-fs',
            host: this.config!.host,
            user: this.config!.username,
            dir: this.remoteDir
        };
    }

    static parseArgs(args: string[], credentials: Partial<RemoteFSCredentials> = {}) {
        let host = credentials.host || 'localhost';
        let port = credentials.port || 22;
        let username = credentials.username || '';
        let password = credentials.password || '';
        let remoteDir = credentials.remoteDir || '/tmp/secure_storage';

        for (let i = 0; i < args.length; i++) {
            if (args[i] === '--remote-host' && i + 1 < args.length) host = args[i + 1];
            if (args[i] === '--remote-port' && i + 1 < args.length) port = parseInt(args[i + 1]);
            if (args[i] === '--remote-user' && i + 1 < args.length) username = args[i + 1];
            if (args[i] === '--remote-pass' && i + 1 < args.length) password = args[i + 1];
            if (args[i] === '--remote-dir' && i + 1 < args.length) remoteDir = args[i + 1];
        }

        return new RemoteFSStorageProvider(host, port, username, password, remoteDir);
    }

    async _getSftp(): Promise<SftpClient> {
        const sftp = new SftpClient();
        await sftp.connect(this.config!);
        return sftp;
    }

    createBlockStream() {
        const physicalBlockId = crypto.randomBytes(16).toString('hex');
        const passThrough = new PassThrough();

        // Since SFTP requires a connection first, we start it asynchronously
        this._getSftp().then(async (sftp) => {
            const remotePath = `${this.remoteDir}/${physicalBlockId}.pkg`;

            try {
                // ssh2-sftp-client can process streams directly
                await sftp.put(passThrough, remotePath);
            } catch (err) {
                logger.error(`[RemoteFSStorageProvider] SFTP Write Error:`, err);
            } finally {
                await sftp.end(); // close connection when done
            }
        }).catch(err => {
            logger.error(`[RemoteFSStorageProvider] Failed to establish SFTP for upload:`, err);
        });

        return { physicalBlockId, writeStream: passThrough };
    }

    async getBlockReadStream(physicalBlockId: string): Promise<GetBlockReadStreamResult> {
        try {
            const sftp = await this._getSftp();
            const remotePath = `${this.remoteDir}/${physicalBlockId}.pkg`;

            const passThrough = new PassThrough();

            sftp.get(remotePath, passThrough).finally(() => {
                sftp.end();
            }).catch((err: NodeJS.ErrnoException) => {
                logger.error(`[RemoteFSStorageProvider] SFTP Read Stream Error:`, err);
                passThrough.emit('error', err);
            });

            return { status: 'available', stream: passThrough };
        } catch (err) {
            logger.error(`[RemoteFSStorageProvider] Failed to get read stream for ${physicalBlockId}:`, err);
            return { status: 'not_found' };
        }
    }
}

export default RemoteFSStorageProvider;
