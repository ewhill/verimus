import { describe, it } from 'node:test';
import assert from 'node:assert';
import MemoryStorageProvider from '../MemoryProvider';
import { PassThrough } from 'stream';

describe('Backend: memoryProvider Integrity (Hermetic in-memory file abstractions)', () => {

    it('Initializes map array resolving ephemeral mappings dynamically', async () => {
        const prov = MemoryStorageProvider.parseArgs([]);
        assert.ok(prov);
        assert.ok(prov.storage instanceof Map);
        
        const loc = prov.getLocation();
        assert.strictEqual(loc.type, 'memory');
    });

    it('Stores physical blocks resolving base64 cleanly mapped natively asynchronously', async () => {
        const prov = new MemoryStorageProvider();
        
        const blockHash = await prov.storeBlock(Buffer.from('volatile chunk natively streamed'));
        assert.ok(prov.storage.has(blockHash));
        assert.strictEqual(prov.storage.get(blockHash)!.toString(), 'volatile chunk natively streamed');
    });

    it('Pipes write streams resolving cleanly bound data streams logically natively safely', async () => {
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

    it('Returns read stream null capturing missing objects mapping physically explicitly safely reliably', async () => {
         const prov = new MemoryStorageProvider();
         
         const pt = await prov.getBlockReadStream('nonexistent');
         assert.deepStrictEqual(pt, { status: 'not_found' });
    });

    it('Provides valid piped read streams emitting physically read buffers safely cleanly accurately natively', async () => {
         const prov = new MemoryStorageProvider();
         const hash = await prov.storeBlock('raw read data');
         
         const pt = await prov.getBlockReadStream(hash);
         assert.ok((pt as any).stream instanceof PassThrough);
         
         let readChunks = '';
         (pt as any).stream.on('data', (d: Buffer) => readChunks += d.toString());
         await new Promise(r => (pt as any).stream.on('end', r));
         assert.strictEqual(readChunks, 'raw read data');
    });
});
