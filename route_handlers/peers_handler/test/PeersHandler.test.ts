import assert from 'node:assert';
import { describe, it } from 'node:test';

import peersHandler from '../PeersHandler';

function createRes() {
    const res: any = { statusCode: 200, body: null };
    res.status = (code: number) => { res.statusCode = code; return res; };
    res.json = (data: any) => { res.body = data; return res; };
    return res;
}

describe('Backend: peersHandler Integrity', () => {
    it('Returns empty array when no peer data exists globally', async () => {
        const req: any = {};
        const res = createRes();
        
        const node: any = { peer: {}, ledger: {}, publicKey: Buffer.from('MOCK_PUB_KEY').toString('base64') };
        const handler = new peersHandler(node);
        await handler.handle(req, res);
        
        const data = res.body;
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.peers.length, 1); // MockPeerNode provides publicKey, so 'self' is always listed.
    });

    it('Maps populated local peer structs matching API expectations', async () => {
        const req: any = {};
        const res = createRes();
        
        const node: any = { ledger: {}, publicKey: Buffer.from('MOCK_PUB_KEY').toString('base64') };
        Object.defineProperty(node, 'peer', { value: {
            peers: [
                { peerAddress: 'host1', remoteSignature: Buffer.from('remoteSig000000000000000000000'), isConnected: true, isTrusted: true },
                { peerAddress: 'host2', remoteSignature: null, isConnected: true, isTrusted: false },
                { peerAddress: 'host3', remoteSignature: null, isConnected: false },
                { remoteSignature: null, isConnected: false } // missing peerAddress
            ]
        } });
        
        const handler = new peersHandler(node);
        await handler.handle(req, res);
        
        const data = res.body;
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.peers.length, 5); // 1 self + 4 mock peers
        assert.strictEqual(data.connectedCount, 1);
        
        const expectedSig = Buffer.from(Buffer.from('MOCK_PUB_KEY').toString('base64')).toString('base64').slice(-16);
        assert.strictEqual(data.peers[0].status, 'self');
        assert.strictEqual(data.peers[0].signature, expectedSig); // self signature from MockPeerNode
        assert.strictEqual(data.peers[1].status, 'connected');
        assert.strictEqual(data.peers[2].status, 'upgrading');
        assert.strictEqual(data.peers[3].status, 'disconnected');
        assert.strictEqual(data.peers[4].address, 'unknown'); // missing peerAddress fallback
    });

    it('Defaults to an empty peers array preventing missing definition crashes', async () => {
        const req: any = {};
        const res = createRes();
        
        const node: any = { ledger: {}, publicKey: Buffer.from('MOCK_PUB_KEY').toString('base64') };
        Object.defineProperty(node, 'peer', { value: {} });
        
        const handler = new peersHandler(node);
        await handler.handle(req, res);
        
        const data = res.body;
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.peers.length, 1); // Only self
    });

    it('Catches exceptions and returns 500 error', async () => {
        const req: any = {};
        const res = createRes();
        const node: any = { ledger: {}, publicKey: Buffer.from('MOCK_PUB_KEY').toString('base64') };
        Object.defineProperty(node, 'peer', {
            get: function() { throw new Error("peer crash test"); }
        });

        const handler = new peersHandler(node);
        await handler.handle(req, res);
        
        assert.strictEqual(res.statusCode, 500);
        const data = res.body;
        assert.strictEqual(data.success, false);
    });
});
