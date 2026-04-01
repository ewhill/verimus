import assert from 'node:assert';
import { describe, it, mock } from 'node:test';


import { Collection } from 'mongodb';

import { createMock } from '../../../test/utils/TestUtils';
import type { PeerReputation } from '../../../types';
import { ReputationManager } from '../ReputationManager';

const createMockCollection = (data: Record<string, any> = {}) => createMock<Collection<PeerReputation>>({
    findOne: mock.fn<({ publicKey }: { publicKey: string }) => Promise<PeerReputation | null>>(async ({ publicKey }: { publicKey: string }) => data[publicKey] || null) as any,
    insertOne: mock.fn<(doc: any) => Promise<void>>(async (doc: any) => { data[doc.publicKey] = { ...doc }; }) as any,
    updateOne: mock.fn<(filter: { publicKey: string }, updateDoc: any) => Promise<void>>(async ({ publicKey }: { publicKey: string }, updateDoc: any) => { 
        if (!data[publicKey]) data[publicKey] = { publicKey, ...(updateDoc.$setOnInsert || {}) };
        if (updateDoc.$set) data[publicKey] = { ...data[publicKey], ...updateDoc.$set };
    }) as any
});

describe('Backend: ReputationManager Analytics and Threshold Parsing', () => {

    it('Enforces 100 maximum score bounds', async () => {
        const mockCollectionData: Record<string, any> = {};
        const mockCollection = createMockCollection(mockCollectionData);
        const manager = new ReputationManager(mockCollection);

        await manager.rewardValidSync('test_honest'); // Starts at 100 
        const updatedScore = await manager.getScore('test_honest');

        // Assert mathematical bound caps at precisely 100 without overextending
        assert.strictEqual(updatedScore, 100);
    });

    it('Penalizes without dropping below 0', async () => {
        const mockCollectionData: Record<string, any> = {};
        const mockCollection = createMockCollection(mockCollectionData);
        const manager = new ReputationManager(mockCollection);

        await manager.penalizeCritical('test_malicious', 'Signature forgery');
        await manager.penalizeMinor('test_malicious', 'Spam looping'); // Drops below 0 internally

        const score = await manager.getScore('test_malicious');
        const bannedStatus = await manager.isBanned('test_malicious');

        // Assert strict baseline limits
        assert.strictEqual(score, 0);
        assert.strictEqual(bannedStatus, true);
    });

    it('Computes strikes based on infractions', async () => {
        const mockCollectionData: Record<string, any> = {};
        const mockCollection = createMockCollection(mockCollectionData);
        const manager = new ReputationManager(mockCollection);

        await manager.penalizeMinor('test_faulty', 'Spam');
        await manager.penalizeMajor('test_faulty', 'Bad schema');

        const peer = await mockCollection.findOne({ publicKey: 'test_faulty' } as any) as any;

        assert.strictEqual(peer.score, 89);
        assert.strictEqual(peer.strikeCount, 2);
        assert.strictEqual(peer.lastOffense, 'Bad schema');
    });

    it('Ignores invalid reputation penalties', async () => {
        const mockCollectionData: Record<string, any> = {};
        const mockCollection = createMockCollection(mockCollectionData);
        const manager = new ReputationManager(mockCollection);

        // Seed peer implicitly
        mockCollectionData['test_node'] = {
            publicKey: 'test_node', score: 95, strikeCount: 1, isBanned: false, lastOffense: 'Spam'
        };

        await manager.rewardValidSync('test_node');

        const peer = await mockCollection.findOne({ publicKey: 'test_node' } as any) as any;
        assert.strictEqual(peer.score, 96);
        assert.strictEqual(peer.strikeCount, 1); // Reward MUST NOT artificially alter strike metrics
    });
});
