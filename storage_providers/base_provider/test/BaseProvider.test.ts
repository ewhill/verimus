import { describe, it } from 'node:test';
import assert from 'node:assert';
import BaseStorageProvider from '../BaseProvider';

describe('Backend: BaseStorageProvider Coverage Tests', () => {

    it('Initializes generic base storage class interface instances', () => {
        assert.ok(BaseStorageProvider !== undefined);
    });

    it('Throws interface errors invoking unimplemented virtual stream abstraction methods', async () => {
        const provider = new BaseStorageProvider();
        
        assert.throws(() => provider.getLocation(), { message: 'getLocation not implemented' });
        assert.throws(() => BaseStorageProvider.parseArgs([]), { message: 'parseArgs() must be implemented by subclasses' });
        
        try {
            await provider.storeBlock(Buffer.from('data'));
            assert.fail('Should throw');
        } catch (err: any) {
            assert.strictEqual(err.message, 'storeBlock() must be implemented by subclasses');
        }

        assert.throws(() => provider.createBlockStream(), { message: 'createBlockStream not implemented' });
        
        try {
            await provider.getBlockReadStream('id');
            assert.fail('Should throw');
        } catch (err: any) {
            assert.strictEqual(err.message, 'getBlockReadStream not implemented');
        }
        
        assert.throws(() => provider.generatePhysicalBlockId('id'), { message: 'generatePhysicalBlockId() must be implemented by subclasses' });
    });
});
