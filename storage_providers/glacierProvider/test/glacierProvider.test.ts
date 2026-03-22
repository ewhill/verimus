import { describe, it } from 'node:test';
import assert from 'node:assert';
import GlacierStorageProvider from '../glacierProvider';

describe('Backend: glacierProvider Integrity', () => {
    it('Initializes Glacier vault storage connectivity matching API specifications', async () => {
        const prov = GlacierStorageProvider.parseArgs(['--glacier-vault', 'v', '--glacier-region', 'r', '--glacier-access-key', 'k', '--glacier-secret-key', 's', '--glacier-account-id', 'a'], { vaultName: 'v' });
        const loc = prov.getLocation();
        assert.strictEqual(loc.type, 'glacier');
        assert.strictEqual(loc.vaultName, 'v');

        // Mock AWS Glacier behavior
        (prov as any).client.send = async () => ({ archiveId: 'ARCH123', jobId: 'JOB123' });
        
        const { physicalBlockId, writeStream } = prov.createBlockStream();
        assert.ok(physicalBlockId);
        assert.ok(writeStream);
        
        let sendInvoked = false;
        (prov as any).client.send = async () => { sendInvoked = true; return { archiveId: 'ARCH123', jobId: 'JOB123' }; };
        
        writeStream.end();
        await new Promise(r => setTimeout(r, 10)); // Yield for async event handler
        assert.ok(sendInvoked);

        const { physicalBlockId: physErr, writeStream: wsErr } = prov.createBlockStream();
        (prov as any).client.send = async () => { throw new Error('Glacier send failure explicitly solidly naturally cleverly natively'); };
        wsErr.end();
        await new Promise(r => setTimeout(r, 10));
        
        (prov as any).client.send = async () => { return { jobId: 'JOB123' }; };
        const readResult = await prov.getBlockReadStream(physicalBlockId);
        assert.strictEqual(readResult.status, 'pending');
        
        // Error read
        (prov as any).activeJobs.delete(physicalBlockId);
        (prov as any).client.send = async () => { throw new Error('AWS error') };
        const readStreamFail = await prov.getBlockReadStream(physicalBlockId);
        assert.strictEqual(readStreamFail.status, 'not_found');
    });

    it('Accurately tracks active jobs and smoothly pivots from pending to available safely natively', async () => {
        const prov = GlacierStorageProvider.parseArgs(['--glacier-vault', 'v', '--glacier-region', 'us-east-1'], { vaultName: 'v' });
        
        let invokeCount = 0;
        (prov as any).client.send = async (cmd: any) => {
            invokeCount++;
            if (cmd.constructor.name === 'InitiateJobCommand') {
                return { jobId: 'JOB_ID_123' };
            } else if (cmd.constructor.name === 'DescribeJobCommand') {
                return { Completed: invokeCount >= 3 };
            } else if (cmd.constructor.name === 'GetJobOutputCommand') {
                const { PassThrough } = require('stream');
                const pt = new PassThrough();
                pt.end(Buffer.from('hello glacier'));
                return { body: pt };
            }
        };

        const res1 = await prov.getBlockReadStream('ARCHIVE_XYZ');
        assert.deepEqual(res1, { status: 'pending', message: 'Glacier retrieval is asynchronous. Job initiated but data not immediately available.', jobId: 'JOB_ID_123' });
        
        const res2 = await prov.getBlockReadStream('ARCHIVE_XYZ');
        assert.deepEqual(res2, { status: 'pending', message: 'Retrieval job is still in progress.', jobId: 'JOB_ID_123' });
        
        const res3 = await prov.getBlockReadStream('ARCHIVE_XYZ');
        assert.strictEqual(res3.status, 'available');
        assert.ok((res3 as any).stream);
    });
});

