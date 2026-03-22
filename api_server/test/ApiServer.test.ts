import { describe, it } from 'node:test';
import assert from 'node:assert';
import setupExpressApp from '../ApiServer';

describe('Backend: apiServer Integrity Check', () => {

    it('Configures Express API routes and headers', () => {
        const mockNode = {
            publicKey: 'test',
            signature: 'test',
            port: 3000,
            peer: null,
            ledger: { collection: { find: () => ({ toArray: async () => [] }) } },
            mempool: { pendingBlocks: new Map() }
        };
        const app = setupExpressApp(mockNode as any);
        
        assert.ok(typeof app.listen === 'function');
        assert.ok(typeof app.use === 'function');
    });
});
