import assert from 'node:assert';
import { describe, it } from 'node:test';

import { MockAwsClient } from '../../../test/mocks/MockAwsClient';
import S3StorageProvider from '../S3Provider';

describe('Backend: s3Provider Integrity', () => {
    it('Initializes S3 bucket access provider validating access commands', async () => {
        const prov = S3StorageProvider.parseArgs(['--s3-bucket', 'mybucket', '--s3-region', 'us-west-2', '--s3-access-key', 'A', '--s3-secret-key', 'B'], { bucket: 'b' });
        const loc = prov.getLocation();
        assert.strictEqual(loc.type, 's3');
        assert.strictEqual(loc.bucket, 'mybucket');

        // Mock AWS S3 behavior
        const mockClient = new MockAwsClient();
        mockClient.send = async () => ({ Body: 'mock-stream' });
        prov.client = mockClient as unknown as typeof prov.client;
        
        const { physicalBlockId, writeStream } = prov.createBlockStream();
        assert.ok(physicalBlockId);
        assert.ok(writeStream);
        
        const readStream = await prov.getBlockReadStream(physicalBlockId);
        assert.deepStrictEqual(readStream, { status: 'available', stream: 'mock-stream' });
        
        // Error read
        (prov.client as unknown as MockAwsClient).send = async () => { throw new Error('AWS error'); };
        const readStreamFail = await prov.getBlockReadStream(physicalBlockId);
        assert.deepStrictEqual(readStreamFail, { status: 'not_found' });
    });
});

