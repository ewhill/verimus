import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import WalletManager from '../WalletManager';
import Ledger from '../../ledger/Ledger';
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

    it('Tests SYSTEM boundary checks effectively verifying infinite mint capabilities', async () => {
        const mockLedger = {
            collection: { find: () => ({ toArray: async () => [] }) }
        } as unknown as Ledger;
        const walletManager = new WalletManager(mockLedger);
        const balance = await walletManager.calculateBalance('SYSTEM');
        assert.strictEqual(balance, Infinity);

        const hasFunds = await walletManager.verifyFunds('SYSTEM', 99999999);
        assert.strictEqual(hasFunds, true);

        const approved = await walletManager.allocateFunds('SYSTEM', 'peerC', 500000, 'SYSTEM_SIG');
        assert.ok(approved);
        assert.strictEqual(approved.amount, 500000);
    });

    it('Calculates fractional block rewards explicitly via continuous mathematical scaling formulas', async () => {
        const genesisTimestamp = 1711238400000;
        
        // Exact genesis time mappings reward full node payload bounds
        const genesisReward = WalletManager.calculateSystemReward(genesisTimestamp, genesisTimestamp);
        assert.strictEqual(genesisReward, 50.0);

        // 4 Years physical timing maps half-life Kryders mapping mathematically
        const fourYearsLater = genesisTimestamp + (4 * 365.25 * 24 * 60 * 60 * 1000);
        const fourYearReward = WalletManager.calculateSystemReward(fourYearsLater, genesisTimestamp);
        // Approximately 25.0
        assert.ok(fourYearReward > 24.9 && fourYearReward < 25.1);

        // 10 Years out verifies long term fractional decay
        const tenYearsLater = genesisTimestamp + (10 * 365.25 * 24 * 60 * 60 * 1000);
        const tenYearReward = WalletManager.calculateSystemReward(tenYearsLater, genesisTimestamp);
        
        // expected: 50 * exp(-ln2 * 10 / 4) = 50 * exp(-1.7328) = 50 * 0.17677 = 8.838
        assert.ok(tenYearReward > 8.8 && tenYearReward < 8.9);

        // Sub-genesis blocks revert natively mapping exactly 50
        const preGenesis = genesisTimestamp - 1000000;
        const preGenesisReward = WalletManager.calculateSystemReward(preGenesis, genesisTimestamp);
        assert.strictEqual(preGenesisReward, 50.0);
    });
});
