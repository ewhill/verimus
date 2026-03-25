import assert from 'node:assert';
import { describe, it } from 'node:test';

import peersHandler from '../PeersHandler';

describe('Backend: peersHandler Integrity', () => {
    it('Returns empty array when no peer data exists globally', async () => {
        let jsonStr = '';
        const req = {};
        const res = { json(data: any) { jsonStr = JSON.stringify(data); return this; } };
        
        const node = { peer: null };
        const handler = new peersHandler(node as any);
        await handler.handle(req as any, res as any);
        
        const data = JSON.parse(jsonStr);
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.peers.length, 0);
    });

    it('Maps populated local peer structs matching API expectations', async () => {
        let jsonStr = '';
        const req = {};
        const res = { json(data: any) { jsonStr = JSON.stringify(data); return this; } };
        
        const node = { 
            port: 3000,
            ledger: { peersCollection: { find: () => ({ toArray: async () => [] }) } },
            peer: {
                // missing signature to hit fallback
                peers: [
                    { peerAddress: 'host1', remoteSignature: Buffer.from('remoteSig000000000000000000000'), isConnected: true, isTrusted: true },
                    { peerAddress: 'host2', remoteSignature: null, isConnected: true, isTrusted: false },
                    { peerAddress: 'host3', remoteSignature: null, isConnected: false },
                    { remoteSignature: null, isConnected: false } // missing peerAddress
                ]
            }
        };
        
        const handler = new peersHandler(node as any);
        await handler.handle(req as any, res as any);
        
        const data = JSON.parse(jsonStr);
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.peers.length, 5); 
        assert.strictEqual(data.connectedCount, 1);
        
        assert.strictEqual(data.peers[0].status, 'self');
        assert.strictEqual(data.peers[0].signature, null); // self signature missing fallback
        assert.strictEqual(data.peers[1].status, 'connected');
        assert.strictEqual(data.peers[2].status, 'upgrading');
        assert.strictEqual(data.peers[3].status, 'disconnected');
        assert.strictEqual(data.peers[4].address, 'unknown'); // missing peerAddress fallback
    });

    it('Defaults to an empty peers array preventing missing definition crashes', async () => {
        let jsonStr = '';
        const req = {};
        const res = { json(data: any) { jsonStr = JSON.stringify(data); return this; } };
        
        const node = { 
            port: 3000,
            ledger: { peersCollection: { find: () => ({ toArray: async () => [] }) } },
            peer: {} // peers undefined
        };
        
        const handler = new peersHandler(node as any);
        await handler.handle(req as any, res as any);
        
        const data = JSON.parse(jsonStr);
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.peers.length, 1); // Only self
    });

    it('Catches', async () => {
        let statusObj = 200; let jsonStr = '';
        const req = {};
        const res = { 
            status(s: number) { statusObj = s; return this; },
            json(data: any) { jsonStr = JSON.stringify(data); return this; }
        };
        const node = {
            get peer() {
                throw new Error("peer crash test");
            }
        };
        const handler = new peersHandler(node as any);
        await handler.handle(req as any, res as any);
        
        assert.strictEqual(statusObj, 500);
        const data = JSON.parse(jsonStr);
        assert.strictEqual(data.success, false);
    });
});
