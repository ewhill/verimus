import assert from 'node:assert';
import { describe, it } from 'node:test';

import BaseStorageProvider from '../BaseProvider';

describe('Backend: BaseStorageProvider Coverage Tests', () => {

    it('Initializes generic base storage class interface instances', () => {
        assert.ok(BaseStorageProvider !== undefined);
    });

    it('Throws interface errors when invoking unimplemented virtual stream methods', async () => {
        class DummyProvider extends BaseStorageProvider {
            getCostPerGB() { return 0; }
            getEgressCostPerGB() { return 0; }
        }
        const provider = new DummyProvider();
        
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
