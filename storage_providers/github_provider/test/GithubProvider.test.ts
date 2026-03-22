import { describe, it } from 'node:test';
import assert from 'node:assert';
import GithubStorageProvider from '../GithubProvider';
import { PassThrough } from 'stream';

describe('Backend: githubProvider Integrity', () => {

    it('Initializes GitHub repository connectivity mapping API properly', async () => {
        const prov = GithubStorageProvider.parseArgs(
            ['--github-owner', 'octocat', '--github-repo', 'hello-world', '--github-token', 'tkn', '--github-branch', 'dev'],
            {}
        );
        assert.ok(prov);
        assert.strictEqual(prov.owner, 'octocat');
        assert.strictEqual(prov.repo, 'hello-world');
        assert.strictEqual(prov.token, 'tkn');
        assert.strictEqual(prov.branch, 'dev');
        
        const loc = prov.getLocation();
        assert.strictEqual(loc.type, 'github');
        assert.strictEqual(loc.repo, 'octocat/hello-world');
        assert.strictEqual(loc.branch, 'dev');
    });

    it('Returns null parsing partial arguments avoiding invalid states', async () => {
        const prov = GithubStorageProvider.parseArgs(
            ['--github-owner', 'octocat'], // missing repo & token
            {}
        );
        assert.strictEqual(prov, null);
    });

    it('Validates fallback fetching mechanism logic correctly integrating with native fetch API natively', async () => {
        const prov = new GithubStorageProvider('owner', 'repo', 'tkn', 'main');
        
        // Mock fetch natively mapped to the environment globally
        let fetchedUrl = '';
        let fetchedOpts: any = null;
        global.fetch = async (url: any, opts: any) => {
            fetchedUrl = url;
            fetchedOpts = opts;
            return {
                ok: true,
                status: 200,
                text: async () => 'OK',
                json: async () => ({ content: Buffer.from('hello').toString('base64') })
            } as any;
        };

        const hash = await prov.storeBlock(Buffer.from('hello'));
        assert.ok(hash);
        assert.ok(fetchedUrl.includes('api.github.com/repos/owner/repo/contents/'));
        assert.strictEqual(fetchedOpts.method, 'PUT');
        assert.ok(fetchedOpts.headers['Authorization'].includes('tkn'));

        const pt = await prov.getBlockReadStream(hash);
        assert.ok((pt as any).stream instanceof PassThrough);
        let readChunks = '';
        (pt as any).stream.on('data', (d: Buffer) => readChunks += d.toString());
        await new Promise(r => (pt as any).stream.on('end', r));
        assert.strictEqual(readChunks, 'hello');
    });

    it('Handles 404 cleanly and explicitly when fetching github artifacts fails dynamically', async () => {
         const prov = new GithubStorageProvider('owner', 'repo', 'tkn', 'main');
         
         global.fetch = async () => ({ ok: false, status: 404 }) as any;
         const pt = await prov.getBlockReadStream('nonexistent');
         assert.deepStrictEqual(pt, { status: 'not_found' });
    });

    it('Throws gracefully explicitly mapping stream errors cleanly logically properly', async () => {
         const prov = new GithubStorageProvider('owner', 'repo', 'tkn', 'main');
         
         global.fetch = async () => ({ ok: false, status: 500, statusText: 'Internal Server Error' }) as any;
         
         const pt = await prov.getBlockReadStream('fail_test');
         assert.deepStrictEqual(pt, { status: 'not_found' });
    });

    it('Processes createBlockStream pipelines appropriately piping logic logically explicitly natively', async () => {
        const prov = new GithubStorageProvider('owner', 'repo', 'tkn', 'main');
        
        let fetchedOpts: any = null;
        global.fetch = async (url: any, opts: any) => {
            fetchedOpts = opts;
            return { ok: true, status: 200 } as any;
        };

        const { physicalBlockId, writeStream } = prov.createBlockStream();
        assert.ok(physicalBlockId);
        assert.ok(writeStream);
        
        writeStream.end(Buffer.from('streamed data'));
        await new Promise(r => setTimeout(r, 50)); // let stream flush and async fetch logic execute
        
        assert.ok(fetchedOpts);
        const body = JSON.parse(fetchedOpts.body);
        assert.strictEqual(Buffer.from(body.content, 'base64').toString(), 'streamed data');
    });
});
