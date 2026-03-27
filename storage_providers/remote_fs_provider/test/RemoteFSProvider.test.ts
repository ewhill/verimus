import assert from 'node:assert';
import { describe, it } from 'node:test';

import RemoteFSStorageProvider from '../RemoteFSProvider';

describe('Backend: remoteFSProvider Integrity', () => {
    it('Initializes SFTP remote filesystem connection configuration mapped', async () => {
        const prov = RemoteFSStorageProvider.parseArgs(['--remote-host', '1.2.3.4', '--remote-port', '2222', '--remote-user', 'usr', '--remote-pass', 'pwd', '--remote-dir', '/var/data'], { host: 'h' });
        const loc = prov.getLocation();
        assert.strictEqual(loc.type, 'remote-fs');
        assert.strictEqual(loc.dir, '/var/data');

        // Mock SFTP behavior
        const mockSftp: any = {
            put: async () => {},
            get: async () => Buffer.from('mock'),
            end: async () => {}
        };
        prov._getSftp = async () => mockSftp;
        
        const { physicalBlockId, writeStream } = prov.createBlockStream();
        assert.ok(physicalBlockId);
        assert.ok(writeStream);
        
        const readStream = await prov.getBlockReadStream(physicalBlockId);
        assert.ok(readStream);
        
        // Error read
        prov._getSftp = async () => { throw new Error('SFTP err'); };
        const rsFail = await prov.getBlockReadStream(physicalBlockId);
        assert.deepStrictEqual(rsFail, { status: 'not_found' });
    });
});

