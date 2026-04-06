import { Request, Response } from 'express';



import BaseHandler from '../base_handler/BaseHandler';

export default class PeersHandler extends BaseHandler {
    async handle(_unusedReq: Request, res: Response) {
    try {
        if (!this.node.peer) {
            return res.json({ success: true, peers: [], connectedCount: 0 });
        }

        let mongoPeers: any[] = [];
        if (this.node.ledger.peersCollection) {
             mongoPeers = await this.node.ledger.peersCollection.find({}).toArray();
        }

        const peers = (this.node.peer.peers || []).map(conn => {
            const pubKey = conn.remoteCredentials_?.rsaKeyPair?.public?.toString('utf8');
            const pg = mongoPeers.find(p => p.publicKey === pubKey);
            return {
                address: conn.peerAddress || 'unknown',
                walletAddress: pg ? pg.operatorAddress : null,
                signature: pubKey ? Buffer.from(pubKey).toString('base64').slice(-16) : null,
                status: conn.isConnected ? (conn.isTrusted ? 'connected' : 'upgrading') : 'disconnected',
                score: pg ? pg.score : 100,
                isBanned: pg ? pg.isBanned : false,
                strikeCount: pg ? pg.strikeCount : 0
            };
        });
        
        // Also include the current node itself
        const selfPg = mongoPeers.find(p => p.publicKey === this.node.publicKey);
        const self = {
            address: `127.0.0.1:${this.node.port}`,
            walletAddress: this.node.walletAddress,
            signature: this.node.publicKey ? Buffer.from(this.node.publicKey).toString('base64').slice(-16) : null,
            status: 'self',
            score: selfPg ? selfPg.score : 100,
            isBanned: selfPg ? selfPg.isBanned : false,
            strikeCount: selfPg ? selfPg.strikeCount : 0
        };
        const connectedCount = peers.filter(p => p.status === 'connected').length;

        // Extract internal Engine P2P limits dynamically
        const gossipTelemetry = {
             messageCacheSize: this.node.peer.seenMessageHashes_ ? this.node.peer.seenMessageHashes_.size : 0,
             discoveryBookSize: this.node.peer.discoveryAddressBook_ ? Object.keys(this.node.peer.discoveryAddressBook_).length : 0,
             maxPeers: (this.node.peer as any).maxSockets_ || 50
        };

        res.json({ success: true, peers: [self, ...peers], connectedCount, gossipTelemetry });
    } catch (error: any) {
        console.error('[API Error] /api/peers:', error);
        res.status(500).json({ success: false, message: error.message });
    }
    }
}
