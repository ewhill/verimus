import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ReputationManager } from '../ReputationManager';

class MockCollection {
    data: any = {};
    async findOne({ publicKey }: { publicKey: string }) {
        return this.data[publicKey] || null;
    }
    async insertOne(doc: any) {
        this.data[doc.publicKey] = { ...doc };
    }
    async updateOne({ publicKey }: { publicKey: string }, { $set }: any) {
        this.data[publicKey] = { ...this.data[publicKey], ...$set };
    }
}

describe('Backend: ReputationManager Analytics and Threshold Parsing', () => {

    it('Enforces 100 maximum score bounds', async () => {
        const mockCollection = new MockCollection() as any;
        const manager = new ReputationManager(mockCollection);
        
        await manager.rewardValidSync('test_honest'); // Starts at 100 natively 
        const updatedScore = await manager.getScore('test_honest');
        
        // Assert mathematical bound caps at precisely 100 without overextending
        assert.strictEqual(updatedScore, 100); 
    });

    it('Penalizes without dropping below 0', async () => {
        const mockCollection = new MockCollection() as any;
        const manager = new ReputationManager(mockCollection);
        
        await manager.penalizeCritical('test_malicious', 'Signature forgery');
        await manager.penalizeMinor('test_malicious', 'Spam looping'); // Drops below 0 internally
        
        const score = await manager.getScore('test_malicious');
        const bannedStatus = await manager.isBanned('test_malicious');
        
        // Assert strict baseline limits dynamically
        assert.strictEqual(score, 0);
        assert.strictEqual(bannedStatus, true);
    });

    it('Computes strikes based on infractions', async () => {
        const mockCollection = new MockCollection() as any;
        const manager = new ReputationManager(mockCollection);
        
        await manager.penalizeMinor('test_faulty', 'Spam');
        await manager.penalizeMajor('test_faulty', 'Bad schema');
        
        const peer = await mockCollection.findOne({ publicKey: 'test_faulty' });
        
        assert.strictEqual(peer.score, 89);
        assert.strictEqual(peer.strikeCount, 2);
        assert.strictEqual(peer.lastOffense, 'Bad schema');
    });

    it('Ignores invalid reputation penalties', async () => {
        const mockCollection = new MockCollection() as any;
        const manager = new ReputationManager(mockCollection);
        
        // Seed peer implicitly
        mockCollection.data['test_node'] = {
            publicKey: 'test_node', score: 95, strikeCount: 1, isBanned: false, lastOffense: 'Spam' 
        };

        await manager.rewardValidSync('test_node');

        const peer = await mockCollection.findOne({ publicKey: 'test_node' });
        assert.strictEqual(peer.score, 96);
        assert.strictEqual(peer.strikeCount, 1); // Reward MUST NOT artificially alter strike metrics natively
    });
});
