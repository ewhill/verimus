import assert from 'node:assert';
import fs from 'node:fs';
import { describe, it } from 'node:test';

import LocalFileStorageProvider from '../LocalProvider';


describe('Backend: localProvider Integrity', () => {
    it('Initializes localized device storage mapping physical disk boundaries', async (t) => {
        t.mock.method(fs, 'existsSync', () => false);
        t.mock.method(fs, 'mkdirSync', () => {});
        t.mock.method(fs, 'writeFileSync', () => {});
        t.mock.method(fs, 'createWriteStream', () => ({ on: () => {} }));
        const mockReadStream = { pipe: () => {} };
        t.mock.method(fs, 'createReadStream', () => mockReadStream);

        const testDir = './test-storage-' + Date.now();
        const prov = LocalFileStorageProvider.parseArgs(['--storage-dir', testDir], { storageDir: testDir });
        assert.ok(prov.storageDir.includes('test-storage'));
        
        const loc = prov.getLocation();
        assert.strictEqual(loc.type, 'local');

        // Create stream
        const { physicalBlockId, writeStream } = prov.createBlockStream();
        assert.ok(physicalBlockId);
        assert.ok(writeStream);
        
        // Store block
        const blockId = await prov.storeBlock('testData123');
        assert.ok(blockId);
        
        // Read stream
        t.mock.method(fs, 'existsSync', () => true);
        const rs = await prov.getBlockReadStream(blockId);
        assert.ok(rs);
        
        // Nonexistent
        t.mock.method(fs, 'existsSync', () => false);
        const noStream = await prov.getBlockReadStream('fakefakefake');
        assert.deepStrictEqual(noStream, { status: 'not_found' });
    });
});

