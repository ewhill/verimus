const Client = require('ssh2').Client;
const BaseStorageProvider = require('../base_provider/BaseProvider');
const { hashData } = require('../../crypto_utils/CryptoUtils');
const logger = require('../../logger/Logger');

class RemoteFSStorageProvider extends BaseStorageProvider {
    constructor(host, port, username, password, remoteDir) {
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
            host: this.config.host,
            user: this.config.username,
            dir: this.remoteDir
        };
    }

    static parseArgs(args, credentials = {}) {
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

    async _getSftp() {
        return new Promise((resolve, reject) => {
            const conn = new Client();
            conn.on('ready', () => {
                conn.sftp((err, sftp) => {
                    if (err) reject(err);
                    else resolve({ sftp, conn });
                });
            }).on('error', reject).connect(this.config);
        });
    }

    createPackageStream() {
        const packageId = require('crypto').randomBytes(16).toString('hex');
        const { PassThrough } = require('stream');
        const passThrough = new PassThrough();

        // Since SFTP requires a connection first, we start it asynchronously
        this._getSftp().then(({ sftp, conn }) => {
            const remotePath = `${this.remoteDir}/${packageId}.pkg`;
            const writeStream = sftp.createWriteStream(remotePath);

            passThrough.pipe(writeStream);

            writeStream.on('close', () => {
                conn.end();
            });
            writeStream.on('error', (err) => {
                logger.error(`[RemoteFSStorageProvider] SFTP Write Error:`, err);
                conn.end();
            });
        }).catch(err => {
            logger.error(`[RemoteFSStorageProvider] Failed to establish SFTP for upload:`, err);
        });

        return { packageId, writeStream: passThrough };
    }

    async getBlockReadStream(packageId) {
        try {
            const { sftp, conn } = await this._getSftp();
            const remotePath = `${this.remoteDir}/${packageId}.pkg`;
            const readStream = sftp.createReadStream(remotePath);

            readStream.on('end', () => conn.end());
            readStream.on('error', () => conn.end());

            return readStream;
        } catch (err) {
            logger.error(`[RemoteFSStorageProvider] Failed to get read stream for ${packageId}:`, err);
            return null;
        }
    }
}

module.exports = RemoteFSStorageProvider;
