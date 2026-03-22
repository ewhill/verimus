import { describe, it } from 'node:test';
import assert from 'node:assert';
import SambaStorageProvider from '../sambaProvider';

describe('Backend: sambaProvider Integrity', () => {
    it('Initializes Samba storage provider module properly', async () => {
        const prov = SambaStorageProvider.parseArgs(['--samba-share', '\\\\\\\\host\\\\share', '--samba-user', 'u', '--samba-pass', 'p', '--samba-domain', 'd'], { share: '\\\\\\\\host\\\\share' });
        const loc = prov.getLocation();
        assert.strictEqual(loc.type, 'samba');
        assert.ok(typeof loc.share === 'string' || loc.share === undefined);

        (prov as any).smbClient.writeFile = (name: any, data: any, cb: any) => cb(null);
        (prov as any).smbClient.readFile = (name: any, cb: any) => cb(null, Buffer.from('data'));
        
        const { physicalBlockId, writeStream } = prov.createBlockStream();
        assert.ok(physicalBlockId);
        assert.ok(writeStream);
        
        writeStream.end(); // triggers writeFile
        
        const readStream: any = await prov.getBlockReadStream(physicalBlockId);
        assert.ok(readStream);
        
        // Error read
        (prov as any).smbClient.readFile = (name: any, cb: any) => cb(new Error('SMB err'));
        const rsFail = await prov.getBlockReadStream(physicalBlockId);
        assert.deepStrictEqual(rsFail, { status: 'not_found' });
        
        // Write fail
        (prov as any).smbClient.writeFile = (name: any, data: any, cb: any) => cb(new Error('fail write'));
        const wfail = prov.createBlockStream();
        wfail.writeStream.end(Buffer.from('test'));
    });
});

