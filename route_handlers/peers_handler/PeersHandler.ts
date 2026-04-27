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
            const walletId = conn.remoteCredentials_?.walletAddress;
            const pg = mongoPeers.find(p => p.operatorAddress === walletId);
            return {
                address: conn.peerAddress || 'unknown',
                walletAddress: walletId || (pg ? pg.operatorAddress : null),
                signature: walletId ? Buffer.from(walletId).toString('base64').slice(-16) : null,
                status: conn.isConnected ? (conn.isTrusted ? 'connected' : 'upgrading') : 'disconnected',
                score: pg ? pg.score : 100,
                isBanned: pg ? pg.isBanned : false,
                strikeCount: pg ? pg.strikeCount : 0
            };
        });
        
        // Also include the current node itself
        const selfPg = mongoPeers.find(p => p.operatorAddress === this.node.walletAddress);
        const self = {
            address: `127.0.0.1:${this.node.port}`,
            walletAddress: this.node.walletAddress,
            signature: this.node.walletAddress ? Buffer.from(this.node.walletAddress).toString('base64').slice(-16) : null,
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
