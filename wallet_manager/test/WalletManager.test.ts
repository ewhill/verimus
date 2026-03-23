import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import WalletManager from '../WalletManager';
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('WalletManager', () => {
    let mongod: MongoMemoryServer;
    let mockLedger: any;

    before(async () => {
        mongod = await MongoMemoryServer.create();
    });

    after(async () => {
        if (mongod) await mongod.stop();
    });

    it('Calculates base balance from transaction mapping strictly correctly', async () => {
        mockLedger = {
            collection: {
                find: () => ({
                    toArray: async () => [
                        { type: 'TRANSACTION', payload: { senderId: 'SYSTEM', recipientId: 'peerA', amount: 100 } },
                        { type: 'TRANSACTION', payload: { senderId: 'peerA', recipientId: 'peerB', amount: 20 } },
                        { type: 'TRANSACTION', payload: { senderId: 'peerC', recipientId: 'peerA', amount: 50 } }
                    ]
                })
            }
        };

        const walletManager = new WalletManager(mockLedger);
        const balance = await walletManager.calculateBalance('peerA');
        
        // 100 - 20 + 50 = 130
        assert.strictEqual(balance, 130);
    });

    it('Returns zero if no ledger history maps peer', async () => {
        mockLedger = {
            collection: {
                find: () => ({
                    toArray: async () => []
                })
            }
        };

        const walletManager = new WalletManager(mockLedger);
        const balance = await walletManager.calculateBalance('peerZ');
        assert.strictEqual(balance, 0);
    });

    it('Verifies boundaries accurately checking mathematical state natively', async () => {
         mockLedger = {
            collection: {
                find: () => ({
                    toArray: async () => [
                        { type: 'TRANSACTION', payload: { senderId: 'SYSTEM', recipientId: 'peerA', amount: 50 } }
                    ]
                })
            }
        };

        const walletManager = new WalletManager(mockLedger);
        const hasFunds = await walletManager.verifyFunds('peerA', 25);
        assert.strictEqual(hasFunds, true);

        const hasInsufficient = await walletManager.verifyFunds('peerA', 100);
        assert.strictEqual(hasInsufficient, false);
    });

    it('Allocates valid transactions smoothly blocking invalid mappings cleanly', async () => {
         mockLedger = {
            collection: {
                find: () => ({
                    toArray: async () => [
                        { type: 'TRANSACTION', payload: { senderId: 'SYSTEM', recipientId: 'peerA', amount: 50 } }
                    ]
                })
            }
        };

        const walletManager = new WalletManager(mockLedger);
        const approved = await walletManager.allocateFunds('peerA', 'peerB', 10, 'sig123');
        assert.ok(approved);
        assert.strictEqual(approved.amount, 10);
        assert.strictEqual(approved.senderSignature, 'sig123');

        const blocked = await walletManager.allocateFunds('peerA', 'peerB', 9000, 'sigXYZ');
        assert.strictEqual(blocked, null);
    });
});
