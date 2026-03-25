import assert from 'node:assert';
import { describe, it } from 'node:test';

import { MockPeerNode } from '../../../test/mocks/MockPeerNode';
import { MockRequest } from '../../../test/mocks/MockRequest';
import { MockResponse } from '../../../test/mocks/MockResponse';
import peersHandler from '../PeersHandler';

describe('Backend: peersHandler Integrity', () => {
    it('Returns empty array when no peer data exists globally', async () => {
        const req = new MockRequest();
        const res = new MockResponse();
        
        const node = new MockPeerNode({ peer: null });
        const handler = new peersHandler(node.asPeerNode());
        await handler.handle(req.asRequest(), res.asResponse());
        
        const data = res.body;
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.peers.length, 1); // MockPeerNode provides publicKey, so 'self' is always listed.
    });

    it('Maps populated local peer structs matching API expectations', async () => {
        const req = new MockRequest();
        const res = new MockResponse();
        
        const node = new MockPeerNode();
        node.peer.peers = [
            { peerAddress: 'host1', remoteSignature: Buffer.from('remoteSig000000000000000000000'), isConnected: true, isTrusted: true },
            { peerAddress: 'host2', remoteSignature: null, isConnected: true, isTrusted: false },
            { peerAddress: 'host3', remoteSignature: null, isConnected: false },
            { remoteSignature: null, isConnected: false } // missing peerAddress
        ];
        
        const handler = new peersHandler(node.asPeerNode());
        await handler.handle(req.asRequest(), res.asResponse());
        
        const data = res.body;
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.peers.length, 6); // 1 self + 4 mock peers + 1 missing fallback
        assert.strictEqual(data.connectedCount, 1);
        
        assert.strictEqual(data.peers[0].status, 'self');
        assert.strictEqual(data.peers[0].signature, Buffer.from('MOCK_SIGNATURE').toString('base64')); // self signature from MockPeerNode
        assert.strictEqual(data.peers[1].status, 'connected');
        assert.strictEqual(data.peers[2].status, 'upgrading');
        assert.strictEqual(data.peers[3].status, 'disconnected');
        assert.strictEqual(data.peers[4].address, 'unknown'); // missing peerAddress fallback
    });

    it('Defaults to an empty peers array preventing missing definition crashes', async () => {
        const req = new MockRequest();
        const res = new MockResponse();
        
        const node = new MockPeerNode();
        node.peer = {}; // peers undefined
        
        const handler = new peersHandler(node.asPeerNode());
        await handler.handle(req.asRequest(), res.asResponse());
        
        const data = res.body;
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.peers.length, 1); // Only self
    });

    it('Catches exceptions and returns 500 error', async () => {
        const req = new MockRequest();
        const res = new MockResponse();
        const node = new MockPeerNode();
        Object.defineProperty(node, 'peer', {
            get: function() { throw new Error("peer crash test"); }
        });

        const handler = new peersHandler(node.asPeerNode());
        await handler.handle(req.asRequest(), res.asResponse());
        
        assert.strictEqual(res.statusCode, 500);
        const data = res.body;
        assert.strictEqual(data.success, false);
    });
});
