import assert from 'node:assert';
import { describe, it } from 'node:test';
import { PassThrough } from 'stream';

import GlacierStorageProvider from '../GlacierProvider';
import { createMock } from '../../../test/utils/TestUtils';

describe('Backend: glacierProvider Integrity', () => {
    it('Initializes Glacier vault storage connectivity matching API specifications', async () => {
        const prov = GlacierStorageProvider.parseArgs(['--glacier-vault', 'v', '--glacier-region', 'r', '--glacier-access-key', 'k', '--glacier-secret-key', 's', '--glacier-account-id', 'a'], { vaultName: 'v' });
        const loc = prov.getLocation();
        assert.strictEqual(loc.type, 'glacier');
        assert.strictEqual(loc.vaultName, 'v');

        // Mock AWS Glacier behavior
        const mockClient = createMock<typeof prov.client>({ send: async () => ({ archiveId: 'ARCH123', jobId: 'JOB123' }) });
        prov.client = mockClient;

        const { physicalBlockId, writeStream } = prov.createBlockStream();
        assert.ok(physicalBlockId);
        assert.ok(writeStream);

        let sendInvoked = false;
        mockClient.send = async () => { sendInvoked = true; return { archiveId: 'ARCH123', jobId: 'JOB123' }; };

        writeStream.end();
        await new Promise(r => setTimeout(r, 10)); // Yield for async event handler
        assert.ok(sendInvoked);

        const { writeStream: wsErr } = prov.createBlockStream();
        mockClient.send = async () => { throw new Error('Glacier send failure'); };
        wsErr.end();
        await new Promise(r => setTimeout(r, 10));

        mockClient.send = async () => { return { jobId: 'JOB123' }; };
        const readResult = await prov.getBlockReadStream(physicalBlockId);
        assert.strictEqual(readResult.status, 'pending');

        // Error read
        prov['activeJobs'].delete(physicalBlockId);
        mockClient.send = async () => { throw new Error('AWS error'); };
        const readStreamFail = await prov.getBlockReadStream(physicalBlockId);
        assert.strictEqual(readStreamFail.status, 'not_found');
    });

    it(' tracks active jobs and pivots from pending to available', async () => {
        const prov = GlacierStorageProvider.parseArgs(['--glacier-vault', 'v', '--glacier-region', 'us-east-1'], { vaultName: 'v' });

        let invokeCount = 0;
        const mockClient: any = {
            send: async (cmd: any) => {
                invokeCount++;
                if (cmd.constructor.name === 'InitiateJobCommand') {
                    return { jobId: 'JOB_ID_123' };
                } else if (cmd.constructor.name === 'DescribeJobCommand') {
                    return { Completed: invokeCount >= 3 };
                } else if (cmd.constructor.name === 'GetJobOutputCommand') {

                    const pt = new PassThrough();
                    pt.end(Buffer.from('hello glacier'));
                    return { body: pt };
                }
            }
        };
        prov.client = createMock<typeof prov.client>(mockClient);

        const res1 = await prov.getBlockReadStream('ARCHIVE_XYZ');
        assert.deepEqual(res1, { status: 'pending', message: 'Glacier retrieval is asynchronous. Job initiated but data not immediately available.', jobId: 'JOB_ID_123' });

        const res2 = await prov.getBlockReadStream('ARCHIVE_XYZ');
        assert.deepEqual(res2, { status: 'pending', message: 'Retrieval job is still in progress.', jobId: 'JOB_ID_123' });

        const res3 = await prov.getBlockReadStream('ARCHIVE_XYZ');
        assert.strictEqual(res3.status, 'available');
        if (res3.status !== 'available' || !res3.stream) throw new Error('Stream missing');
        assert.ok(res3.stream);
    });
});

