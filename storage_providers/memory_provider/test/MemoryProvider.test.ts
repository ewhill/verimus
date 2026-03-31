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
        
        await prov.storeShard('mem-shard-1', Buffer.from('volatile chunk streamed'));
        const blockHash = 'mem-shard-1';
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
         await prov.storeShard('mem-shard-2', 'raw read data');
        const hash = 'mem-shard-2';
         
         const pt = await prov.getBlockReadStream(hash);
         if (pt.status !== 'available' || !pt.stream) throw new Error('Stream missing');
         assert.ok(pt.stream instanceof PassThrough);
         
         let readChunks = '';
         pt.stream.on('data', (d: Buffer) => readChunks += d.toString());
         await new Promise(r => pt.stream!.on('end', r));
         assert.strictEqual(readChunks, 'raw read data');
    });
});
