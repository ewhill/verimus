import assert from 'node:assert';
import { describe, it } from 'node:test';
import { PassThrough } from 'stream';

import MemoryStorageProvider from '../MemoryProvider';


describe('Backend: memoryProvider Integrity (Hermetic in-memory file abstractions)', () => {

    it('Initializes map array for ephemeral storage', async () => {
        const prov = MemoryStorageProvider.parseArgs([]);
        assert.ok(prov);
        assert.ok(prov.storage instanceof Map);
        
        const loc = prov.getLocation();
        assert.strictEqual(loc.type, 'memory');
    });

    it('Stores physical blocks resolving base64 data', async () => {
        const prov = new MemoryStorageProvider();
        
        const blockHash = await prov.storeBlock(Buffer.from('volatile chunk streamed'));
        assert.ok(prov.storage.has(blockHash));
        assert.strictEqual(prov.storage.get(blockHash)!.toString(), 'volatile chunk streamed');
    });

    it('Pipes write streams correctly', async () => {
        const prov = new MemoryStorageProvider();
        
        const { physicalBlockId, writeStream } = prov.createBlockStream();
        assert.ok(physicalBlockId);
        assert.ok(writeStream);
        
        writeStream.write(Buffer.from('hello'));
        writeStream.end(Buffer.from('world'));
        
        await new Promise(r => setTimeout(r, 50)); // let stream flush
        
        assert.strictEqual(prov.storage.has(physicalBlockId), true);
        assert.strictEqual(prov.storage.get(physicalBlockId)!.toString(), 'helloworld');
    });

    it('Returns null read stream for missing objects', async () => {
         const prov = new MemoryStorageProvider();
         
         const pt = await prov.getBlockReadStream('nonexistent');
         assert.deepStrictEqual(pt, { status: 'not_found' });
    });

    it('Provides valid read streams emitting buffers', async () => {
         const prov = new MemoryStorageProvider();
         const hash = await prov.storeBlock('raw read data');
         
         const pt = await prov.getBlockReadStream(hash);
         // @ts-ignore
         assert.ok(pt.stream instanceof PassThrough);
         
         let readChunks = '';
         // @ts-ignore
         pt.stream.on('data', (d: Buffer) => readChunks += d.toString());
         // @ts-ignore
         await new Promise(r => pt.stream.on('end', r));
         assert.strictEqual(readChunks, 'raw read data');
    });
});
