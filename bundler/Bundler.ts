export { };
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { hashData, encryptAES, createAESStream } = require('../crypto_utils/CryptoUtils');

class Bundler {
    dataDir: string;

    constructor(dataDir: string) {
        this.dataDir = dataDir;
    }

    /**
     * Takes an array of uploaded files and bundles them into a block.
     */
    createBlockBundle(uploadedFiles: { originalname: string; buffer: Buffer }[]) {
        if (!uploadedFiles || uploadedFiles.length === 0) return null;

        const files: { path: string; contentHash: string; }[] = [];
        for (const file of uploadedFiles) {
            // file object from multer contains { originalname, buffer }
            files.push({
                path: file.originalname,
                contentHash: hashData(file.buffer),
            });
        }

        // Encrypt each of the plurality of data files in the block
        const blockString = JSON.stringify(files);
        const { encryptedData, key, iv } = encryptAES(Buffer.from(blockString, 'utf8'));

        return {
            blockData: encryptedData,
            aesKey: key,
            aesIv: iv,
            files,
        };
    }

    /**
     * Zips, encrypts, and streams uploaded files into outputStream.
     */
    streamBlockBundle(uploadedFiles: Express.Multer.File[], outputStream: NodeJS.WritableStream, sourcePaths: string[] = []) {
        return new Promise<{ aesKey: string, aesIv: string, authTag: string, files: { path: string; contentHash: string; }[] } | null>(async (resolve, reject) => {
            if (!uploadedFiles || uploadedFiles.length === 0) return resolve(null);

            const files: { path: string; contentHash: string; }[] = [];

            const archive = archiver('zip', {
                zlib: { level: 9 }
            });

            const { cipherStream, key, iv, getAuthTag } = createAESStream();

            outputStream.on('close', () => {
                resolve({
                    aesKey: key,
                    aesIv: iv,
                    authTag: getAuthTag().toString('hex'),
                    files: files
                });
            });

            outputStream.on('error', reject);
            archive.on('error', reject);
            cipherStream.on('error', reject);

            archive.pipe(cipherStream).pipe(outputStream);

            for (let i = 0; i < uploadedFiles.length; i++) {
                const file = uploadedFiles[i];
                const filePath = sourcePaths[i] || file.originalname;
                let contentHash = "";
                
                if (file.path) {
                    contentHash = await new Promise<string>((res, rej) => {
                        const hash = require('crypto').createHash('sha256');
                        const st = require('fs').createReadStream(file.path);
                        st.on('data', (d: any) => hash.update(d));
                        st.on('end', () => res(hash.digest('hex')));
                        st.on('error', rej);
                    });
                    files.push({ path: filePath, contentHash });
                    archive.append(require('fs').createReadStream(file.path), { name: filePath });
                } else if (file.buffer) {
                    contentHash = hashData(file.buffer);
                    files.push({ path: filePath, contentHash });
                    archive.append(file.buffer, { name: filePath });
                }
            }

            archive.finalize();
        });
    }
}

export default Bundler;
