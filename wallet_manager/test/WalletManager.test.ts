import assert from 'node:assert';
import { describe, it, mock } from 'node:test';

import { Collection } from 'mongodb';
import { ethers } from 'ethers';

import Ledger from '../../ledger/Ledger';
import { createMock } from '../../test/utils/TestUtils';
import WalletManager from '../WalletManager';

describe('WalletManager', () => {

    it('Calculates base balance from continuous mapping correctly', async () => {
        const testWallet = ethers.Wallet.createRandom().address;
        const mockLedger = createMock<Ledger>({
            balancesCollection: createMock<Collection<any>>({
                findOne: mock.fn<(...args: any[]) => Promise<any>>(async (query: any) => {
                    if (query.address === testWallet) return { balance: 130 };
                    return null;
                })
            }),
            events: { on: mock.fn() } as any,
            blockAddedSubscribers: []
        });

        const walletManager = new WalletManager(mockLedger);
        const balance = await walletManager.calculateBalance(testWallet);
        assert.strictEqual(balance, 130);
    });

    it('Returns native baseline threshold if no ledger history maps peer', async () => {
        const testWallet = ethers.Wallet.createRandom().address;
        const mockLedger = createMock<Ledger>({
            balancesCollection: createMock<Collection<any>>({
                findOne: mock.fn<(...args: any[]) => Promise<any>>(async () => null)
            }),
            events: { on: mock.fn() } as any,
            blockAddedSubscribers: []
        });

        const walletManager = new WalletManager(mockLedger);
        const balance = await walletManager.calculateBalance(testWallet);
        assert.strictEqual(balance, 50);
    });

    it('Verifies boundaries checking mathematical state', async () => {
        const testWallet = ethers.Wallet.createRandom().address;
        const mockLedger = createMock<Ledger>({
            balancesCollection: createMock<Collection<any>>({
                findOne: mock.fn<(...args: any[]) => Promise<any>>(async () => ({ balance: 50 }))
            }),
            events: { on: mock.fn() } as any,
            blockAddedSubscribers: []
        });

        const walletManager = new WalletManager(mockLedger);
        const hasFunds = await walletManager.verifyFunds(testWallet, 25);
        assert.strictEqual(hasFunds, true);

        const hasInsufficient = await walletManager.verifyFunds(testWallet, 100);
        assert.strictEqual(hasInsufficient, false);
    });

    it('Allocates valid transactions blocking invalid mappings', async () => {
        const testWallet = ethers.Wallet.createRandom().address;
        const targetWallet = ethers.Wallet.createRandom().address;
        const mockLedger = createMock<Ledger>({
            balancesCollection: createMock<Collection<any>>({
                findOne: mock.fn<(...args: any[]) => Promise<any>>(async () => ({ balance: 50 }))
            }),
            events: { on: mock.fn() } as any,
            blockAddedSubscribers: []
        });

        const walletManager = new WalletManager(mockLedger);
        const approved = await walletManager.allocateFunds(testWallet, targetWallet, 10, 'sig123');
        assert.ok(approved);
        assert.strictEqual(approved.amount, 10);
        assert.strictEqual(approved.senderSignature, 'sig123');

        const blocked = await walletManager.allocateFunds(testWallet, targetWallet, 9000, 'sigXYZ');
        assert.strictEqual(blocked, null);
    });

    it('Tests SYSTEM boundary checks verifying mint capabilities', async () => {
        const wallet = ethers.Wallet.createRandom().address;
        const mockLedger = createMock<Ledger>({
            balancesCollection: createMock<Collection<any>>({
                findOne: mock.fn<(...args: any[]) => Promise<any>>(async () => null)
            }),
            events: { on: mock.fn() } as any,
            blockAddedSubscribers: []
        });
        const walletManager = new WalletManager(mockLedger);
        const balance = await walletManager.calculateBalance('SYSTEM');
        assert.strictEqual(balance, Infinity);

        const hasFunds = await walletManager.verifyFunds('SYSTEM', 99999999);
        assert.strictEqual(hasFunds, true);

        const approved = await walletManager.allocateFunds('SYSTEM', wallet, 500000, 'SYSTEM_SIG');
        assert.ok(approved);
        assert.strictEqual(approved.amount, 500000);
    });

    it('Calculates fractional block rewards via continuous mathematical scaling formulas', async () => {
        const genesisTimestamp = 1774310400000;

        const genesisReward = WalletManager.calculateSystemReward(genesisTimestamp, genesisTimestamp);
        assert.strictEqual(genesisReward, 50.0);

        const fourYearsLater = genesisTimestamp + (4 * 365.25 * 24 * 60 * 60 * 1000);
        const fourYearReward = WalletManager.calculateSystemReward(fourYearsLater, genesisTimestamp);
        assert.ok(fourYearReward > 24.9 && fourYearReward < 25.1);

        const tenYearsLater = genesisTimestamp + (10 * 365.25 * 24 * 60 * 60 * 1000);
        const tenYearReward = WalletManager.calculateSystemReward(tenYearsLater, genesisTimestamp);
        assert.ok(tenYearReward > 8.8 && tenYearReward < 8.9);

        const preGenesis = genesisTimestamp - 1000000;
        const preGenesisReward = WalletManager.calculateSystemReward(preGenesis, genesisTimestamp);
        assert.strictEqual(preGenesisReward, 50.0);
    });

    it('Freezes funds calculating frozen limits preventing double spending', async () => {
        const testWallet = ethers.Wallet.createRandom().address;
        const targetWallet = ethers.Wallet.createRandom().address;
        
        const mockLedger = createMock<Ledger>({
            balancesCollection: createMock<Collection<any>>({
                findOne: mock.fn<(...args: any[]) => Promise<any>>(async () => ({ balance: 300 }))
            }),
            events: { on: mock.fn() } as any,
            blockAddedSubscribers: []
        });

        const walletManager = new WalletManager(mockLedger);
        const initialBalance = await walletManager.calculateBalance(testWallet);
        assert.strictEqual(initialBalance, 300);

        walletManager.freezeFunds(testWallet, 200, 'contract-A');
        const activeBalance = await walletManager.calculateBalance(testWallet);
        assert.strictEqual(activeBalance, 100);

        const blocked = await walletManager.allocateFunds(testWallet, targetWallet, 150, 'sig');
        assert.strictEqual(blocked, null);

        walletManager.releaseFunds('contract-A');
        const releasedBalance = await walletManager.calculateBalance(testWallet);
        assert.strictEqual(releasedBalance, 300);

        walletManager.freezeFunds(testWallet, 250, 'contract-B');
        assert.strictEqual(await walletManager.calculateBalance(testWallet), 50);
        walletManager.commitFunds('contract-B');
        assert.strictEqual(await walletManager.calculateBalance(testWallet), 300);
    });
});
