import assert from 'node:assert';
import { describe, it } from 'node:test';

import SambaStorageProvider from '../SambaProvider';

describe('Backend: sambaProvider Integrity', () => {
    it('Initializes Samba storage provider module', async () => {
        const prov = SambaStorageProvider.parseArgs(['--samba-share', '\\\\\\\\host\\\\share', '--samba-user', 'u', '--samba-pass', 'p', '--samba-domain', 'd'], { share: '\\\\\\\\host\\\\share' });
        const loc = prov.getLocation();
        assert.strictEqual(loc.type, 'samba');
        assert.ok(typeof loc.share === 'string' || loc.share === undefined);

        // @ts-ignore
        prov.smbClient.writeFile = (_unusedName, _unusedData, cb) => cb(null);
        // @ts-ignore
        prov.smbClient.readFile = (_unusedName, cb) => cb(null, Buffer.from('data'));
        
        const { physicalBlockId, writeStream } = prov.createBlockStream();
        assert.ok(physicalBlockId);
        assert.ok(writeStream);
        
        writeStream.end(); // triggers writeFile
        
        const readStream: any = await prov.getBlockReadStream(physicalBlockId);
        assert.ok(readStream);
        
        // Error read
        // @ts-ignore
        prov.smbClient.readFile = (_unusedName, cb) => cb(new Error('SMB err'));
        const rsFail = await prov.getBlockReadStream(physicalBlockId);
        assert.deepStrictEqual(rsFail, { status: 'not_found' });
        
        // Write fail
        // @ts-ignore
        prov.smbClient.writeFile = (_unusedName, _unusedData, cb) => cb(new Error('fail write'));
        const wfail = prov.createBlockStream();
        wfail.writeStream.end(Buffer.from('test'));
    });
});

