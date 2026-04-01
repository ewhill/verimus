import { EventEmitter } from 'events';

import { Collection } from 'mongodb';

import logger from '../../logger/Logger';
import type { PeerReputation } from '../../types';

export class ReputationManager extends EventEmitter {
    private peersCollection: Collection<PeerReputation> | null;

    constructor(peersCollection: Collection<PeerReputation> | null) {
        super();
        this.peersCollection = peersCollection;
    }

    private async executePeerUpsert(publicKey: string, scoreDelta: number, offense: string | null = null): Promise<PeerReputation | null> {
        if (!this.peersCollection) return null;

        let peer: any = await this.peersCollection.findOne({ publicKey });
        if (!peer) {
            // Implicitly bootstrap new honest peer records tracking 100 mapping baseline bounds
            peer = { publicKey, score: 100, strikeCount: 0, isBanned: false, lastOffense: null };
            try {
                await this.peersCollection.insertOne(peer);
            } catch (err: any) {
                if (err.code !== 11000) throw err; // Ignore duplicate key racing mapping natively 
                peer = await this.peersCollection.findOne({ publicKey });
            }
        }

        // Apply mathematical score adjustments
        let newScore = peer.score + scoreDelta;
        
        // Ensure bounds mapping avoids negative space or over-reward mapping
        if (newScore > 100) newScore = 100;
        if (newScore < 0) newScore = 0;

        const isBanned = newScore === 0;

        // Apply strike tracking counting active infractions
        const strikeCount = scoreDelta < 0 ? peer.strikeCount + 1 : peer.strikeCount;
        const lastOffense = scoreDelta < 0 ? (offense || peer.lastOffense) : peer.lastOffense;

        const updatedPeer = { ...peer, publicKey, score: newScore, strikeCount, isBanned, lastOffense };
        
        await this.peersCollection.updateOne(
            { publicKey },
            { $set: { score: newScore, strikeCount, isBanned, lastOffense } }
        );

        if (scoreDelta < 0) {
            logger.warn(`Peer ${publicKey.substring(0, 16)}... penalized (${scoreDelta}): ${offense}. New Score: ${newScore}`);
        } else if (scoreDelta > 0) {
            logger.info(`Peer ${publicKey.substring(0, 16)}... rewarded (+${scoreDelta}). New Score: ${newScore}`);
        }
        
        if (isBanned && peer.score > 0) { // Just reached 0
            logger.warn(`Peer ${publicKey.substring(0, 16)}... HAS BEEN BANNED across network metrics.`);
            this.emit('banned', publicKey);
        }

        return updatedPeer as PeerReputation;
    }

    async penalizeMinor(publicKey: string, reason: string) {
        return this.executePeerUpsert(publicKey, -1, reason);
    }

    async penalizeMajor(publicKey: string, reason: string) {
        return this.executePeerUpsert(publicKey, -10, reason);
    }

    async penalizeCritical(publicKey: string, reason: string) {
        return this.executePeerUpsert(publicKey, -100, reason);
    }

    async rewardValidSync(publicKey: string) {
        return this.executePeerUpsert(publicKey, 1);
    }

    async rewardHonestProposal(publicKey: string) {
        return this.executePeerUpsert(publicKey, 2);
    }

    async isBanned(publicKey: string): Promise<boolean> {
        if (!this.peersCollection) return false;
        const peer = await this.peersCollection.findOne({ publicKey });
        return peer ? peer.isBanned : false;
    }
    
    async getScore(publicKey: string): Promise<number> {
        if (!this.peersCollection) return 100;
        const peer = await this.peersCollection.findOne({ publicKey });
        return peer ? peer.score : 100;
    }
}
