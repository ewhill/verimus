import { hashData } from '../../cryptoUtils';
import logger from '../../logger';
import { PassThrough } from 'stream';
import BaseStorageProvider, { GetBlockReadStreamResult } from '../baseProvider';
export interface GithubCredentials {
    token?: string;
    owner?: string;
    repo?: string;
    branch?: string;
}

class GithubStorageProvider extends BaseStorageProvider {
    owner: string;
    repo: string;
    token: string;
    branch: string;

    constructor(owner: string, repo: string, token: string, branch: string = 'main') {
        super();
        this.owner = owner;
        this.repo = repo;
        this.token = token;
        this.branch = branch;
    }

    getLocation() {
        return {
            type: 'github',
            repo: `${this.owner}/${this.repo}`,
            branch: this.branch
        };
    }

    static parseArgs(args: string[], credentials: Partial<any> = {}) {
        let owner = credentials.githubOwner;
        let repo = credentials.githubRepo;
        let token = credentials.githubToken;
        let branch = credentials.githubBranch || 'main';

        for (let i = 0; i < args.length; i++) {
            if (args[i] === '--github-owner' && i + 1 < args.length) owner = args[i + 1];
            if (args[i] === '--github-repo' && i + 1 < args.length) repo = args[i + 1];
            if (args[i] === '--github-token' && i + 1 < args.length) token = args[i + 1];
            if (args[i] === '--github-branch' && i + 1 < args.length) branch = args[i + 1];
        }

        if (!owner || !repo || !token) {
            return null;
        }

        logger.info(`[GithubStorageProvider] Initialized for repo: ${owner}/${repo} on branch ${branch}`);
        return new GithubStorageProvider(owner, repo, token, branch);
    }

    async storeBlock(encryptedData: Buffer | string): Promise<string> {
        const payload = typeof encryptedData === 'string' ? encryptedData : encryptedData.toString('base64');
        const contentBase64 = typeof encryptedData === 'string' ? Buffer.from(encryptedData).toString('base64') : payload;
        const physicalBlockId = hashData(Date.now().toString() + Math.random().toString());

        const res = await fetch(`https://api.github.com/repos/${this.owner}/${this.repo}/contents/${physicalBlockId}.pkg`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'Verimus-Node'
            },
            body: JSON.stringify({
                message: `Upload block ${physicalBlockId}`,
                content: contentBase64,
                branch: this.branch
            })
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`GitHub API error: ${res.status} ${res.statusText} - ${err}`);
        }
        
        return physicalBlockId;
    }

    createBlockStream() {
        const physicalBlockId = hashData(Date.now().toString() + Math.random().toString());
        const pt = new PassThrough();
        const bufs: Buffer[] = [];
        
        pt.on('data', (chunk: Buffer) => bufs.push(chunk));
        pt.on('end', async () => {
            try {
                const fullBuffer = Buffer.concat(bufs);
                const contentBase64 = fullBuffer.toString('base64');
                const res = await fetch(`https://api.github.com/repos/${this.owner}/${this.repo}/contents/${physicalBlockId}.pkg`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'Verimus-Node'
                    },
                    body: JSON.stringify({
                        message: `Upload streamed block ${physicalBlockId}`,
                        content: contentBase64,
                        branch: this.branch
                    })
                });
                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(`GitHub API error: ${res.status} ${res.statusText} - ${errText}`);
                }
            } catch (err: any) {
                logger.error(`[GithubStorageProvider] Failed to stream write ${physicalBlockId}.pkg: ${err.message}`);
            }
        });

        return { physicalBlockId, writeStream: pt };
    }

    async getBlockReadStream(physicalBlockId: string): Promise<GetBlockReadStreamResult> {
        try {
            const res = await fetch(`https://api.github.com/repos/${this.owner}/${this.repo}/contents/${physicalBlockId}.pkg?ref=${this.branch}`, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Verimus-Node'
                }
            });

            if (res.status === 404) return { status: 'not_found' };
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

            const data: any = await res.json();
            if (!data.content) throw new Error('Missing file content from GitHub API payload');

            const contentBuffer = Buffer.from(data.content.replace(/\n/g, ''), 'base64');
            
            const pt = new PassThrough();
            pt.end(contentBuffer);
            return { status: 'available', stream: pt };
        } catch (err: any) {
            logger.error(`[GithubStorageProvider] Failed to read ${physicalBlockId}.pkg: ${err.message}`);
            return { status: 'not_found' };
        }
    }
}

export default GithubStorageProvider;
