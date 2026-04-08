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

    private async executePeerUpsert(operatorAddress: string, scoreDelta: number, offense: string | null = null): Promise<PeerReputation | null> {
        if (!this.peersCollection) return null;

        let peer: any = await this.peersCollection.findOne({ operatorAddress });

        let targetOperatorAddress = peer ? peer.operatorAddress : operatorAddress;

        await this.peersCollection.updateOne(
            { operatorAddress: targetOperatorAddress },
            { $setOnInsert: { score: 100, strikeCount: 0, isBanned: false, lastOffense: null } },
            { upsert: true }
        );

        if (!peer) {
            peer = await this.peersCollection.findOne({ operatorAddress: targetOperatorAddress });
        }

        if (!peer) return null;

        // Apply mathematical score adjustments
        let newScore = peer.score + scoreDelta;
        
        // Ensure bounds mapping avoids negative space or over-reward mapping
        if (newScore > 100) newScore = 100;
        if (newScore < 0) newScore = 0;

        const isBanned = newScore === 0;

        // Apply strike tracking counting active infractions
        const strikeCount = scoreDelta < 0 ? peer.strikeCount + 1 : peer.strikeCount;
        const lastOffense = scoreDelta < 0 ? (offense || peer.lastOffense) : peer.lastOffense;

        const updatedPeer = { ...peer, operatorAddress: targetOperatorAddress, score: newScore, strikeCount, isBanned, lastOffense };
        
        await this.peersCollection.updateOne(
            { operatorAddress: targetOperatorAddress },
            { $set: { score: newScore, strikeCount, isBanned, lastOffense } }
        );

        if (scoreDelta < 0) {
            logger.warn(`Peer ${operatorAddress.substring(0, 16)}... penalized (${scoreDelta}): ${offense}. New Score: ${newScore}`);
        } else if (scoreDelta > 0) {
            logger.info(`Peer ${operatorAddress.substring(0, 16)}... rewarded (+${scoreDelta}). New Score: ${newScore}`);
        }
        
        if (isBanned && peer.score > 0) { // Just reached 0
            logger.warn(`Peer ${operatorAddress.substring(0, 16)}... HAS BEEN BANNED across network metrics.`);
            this.emit('banned', operatorAddress);
        }

        return updatedPeer as PeerReputation;
    }

    async penalizeMinor(operatorAddress: string, reason: string) {
        return this.executePeerUpsert(operatorAddress, -1, reason);
    }

    async penalizeMajor(operatorAddress: string, reason: string) {
        return this.executePeerUpsert(operatorAddress, -10, reason);
    }

    async penalizeCritical(operatorAddress: string, reason: string) {
        return this.executePeerUpsert(operatorAddress, -100, reason);
    }

    async rewardValidSync(operatorAddress: string) {
        return this.executePeerUpsert(operatorAddress, 1);
    }

    async rewardHonestProposal(operatorAddress: string) {
        return this.executePeerUpsert(operatorAddress, 2);
    }

    async isBanned(operatorAddress: string): Promise<boolean> {
        if (!this.peersCollection) return false;
        const peer = await this.peersCollection.findOne({ operatorAddress });
        return peer ? peer.isBanned : false;
    }
    
    async getScore(operatorAddress: string): Promise<number> {
        if (!this.peersCollection) return 100;
        const peer = await this.peersCollection.findOne({ operatorAddress });
        return peer ? peer.score : 100;
    }
}
