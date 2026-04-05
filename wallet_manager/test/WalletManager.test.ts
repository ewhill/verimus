import assert from 'node:assert';
import { describe, it, mock } from 'node:test';

import { ethers } from 'ethers';
import { Collection } from 'mongodb';

import Ledger from '../../ledger/Ledger';
import { createMock } from '../../test/utils/TestUtils';
import WalletManager from '../WalletManager';

describe('WalletManager', () => {

    it('Calculates base balance from continuous mapping correctly', async () => {
        const testWallet = ethers.Wallet.createRandom().address;
        const mockLedger = createMock<Ledger>({
            balancesCollection: createMock<Collection<any>>({
                findOne: mock.fn<(...args: any[]) => Promise<any>>(async (query: any) => {
                    if (query.walletAddress === testWallet) return { balance: "130" };
                    return null;
                })
            }),
            events: { on: mock.fn() } as any,
            blockAddedSubscribers: []
        });

        const walletManager = new WalletManager(mockLedger);
        const balance = await walletManager.calculateBalance(testWallet);
        assert.strictEqual(balance, 130n);
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
        assert.strictEqual(balance, ethers.parseUnits("50", 18));
    });

    it('Verifies boundaries checking mathematical state', async () => {
        const testWallet = ethers.Wallet.createRandom().address;
        const mockLedger = createMock<Ledger>({
            balancesCollection: createMock<Collection<any>>({
                findOne: mock.fn<(...args: any[]) => Promise<any>>(async () => ({ balance: "50" }))
            }),
            events: { on: mock.fn() } as any,
            blockAddedSubscribers: []
        });

        const walletManager = new WalletManager(mockLedger);
        const hasFunds = await walletManager.verifyFunds(testWallet, 25n);
        assert.strictEqual(hasFunds, true);

        const hasInsufficient = await walletManager.verifyFunds(testWallet, 100n);
        assert.strictEqual(hasInsufficient, false);
    });

    it('Allocates valid transactions blocking invalid mappings', async () => {
        const testWallet = ethers.Wallet.createRandom().address;
        const targetWallet = ethers.Wallet.createRandom().address;
        const mockLedger = createMock<Ledger>({
            balancesCollection: createMock<Collection<any>>({
                findOne: mock.fn<(...args: any[]) => Promise<any>>(async () => ({ balance: "50" }))
            }),
            events: { on: mock.fn() } as any,
            blockAddedSubscribers: []
        });

        const walletManager = new WalletManager(mockLedger);
        const approved = await walletManager.allocateFunds(testWallet, targetWallet, 10n, 'sig123');
        assert.ok(approved);
        assert.strictEqual(approved.amount, 10n);
        assert.strictEqual(approved.senderSignature, 'sig123');

        const blocked = await walletManager.allocateFunds(testWallet, targetWallet, 9000n, 'sigXYZ');
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
        const balance = await walletManager.calculateBalance(ethers.ZeroAddress);
        assert.strictEqual(balance, ethers.parseUnits("999999999999", 18));

        const hasFunds = await walletManager.verifyFunds(ethers.ZeroAddress, 99999999n);
        assert.strictEqual(hasFunds, true);

        const approved = await walletManager.allocateFunds(ethers.ZeroAddress, wallet, 500000n, 'SYSTEM_SIG');
        assert.ok(approved);
        assert.strictEqual(approved.amount, 500000n);
    });

    it('Calculates fractional block rewards via continuous mathematical scaling formulas', async () => {
        const genesisTimestamp = 1774310400000;

        const genesisReward = WalletManager.calculateSystemReward(genesisTimestamp, genesisTimestamp);
        assert.strictEqual(genesisReward, ethers.parseUnits("50.0", 18));

        const fourYearsLater = genesisTimestamp + (4 * 365.25 * 24 * 60 * 60 * 1000);
        const fourYearReward = WalletManager.calculateSystemReward(fourYearsLater, genesisTimestamp);
        assert.ok(fourYearReward > ethers.parseUnits("24.9", 18) && fourYearReward < ethers.parseUnits("25.1", 18));

        const tenYearsLater = genesisTimestamp + (10 * 365.25 * 24 * 60 * 60 * 1000);
        const tenYearReward = WalletManager.calculateSystemReward(tenYearsLater, genesisTimestamp);
        assert.ok(tenYearReward > ethers.parseUnits("8.8", 18) && tenYearReward < ethers.parseUnits("8.9", 18));

        const preGenesis = genesisTimestamp - 1000000;
        const preGenesisReward = WalletManager.calculateSystemReward(preGenesis, genesisTimestamp);
        assert.strictEqual(preGenesisReward, ethers.parseUnits("50.0", 18));
    });

    it('Freezes funds calculating frozen limits preventing double spending', async () => {
        const testWallet = ethers.Wallet.createRandom().address;
        const targetWallet = ethers.Wallet.createRandom().address;
        
        const mockLedger = createMock<Ledger>({
            balancesCollection: createMock<Collection<any>>({
                findOne: mock.fn<(...args: any[]) => Promise<any>>(async () => ({ balance: "300" }))
            }),
            events: { on: mock.fn() } as any,
            blockAddedSubscribers: []
        });

        const walletManager = new WalletManager(mockLedger);
        const initialBalance = await walletManager.calculateBalance(testWallet);
        assert.strictEqual(initialBalance, 300n);

        walletManager.freezeFunds(testWallet, 200n, 'contract-A');
        const activeBalance = await walletManager.calculateBalance(testWallet);
        assert.strictEqual(activeBalance, 100n);

        const blocked = await walletManager.allocateFunds(testWallet, targetWallet, 150n, 'sig');
        assert.strictEqual(blocked, null);

        walletManager.releaseFunds('contract-A');
        const releasedBalance = await walletManager.calculateBalance(testWallet);
        assert.strictEqual(releasedBalance, 300n);

        walletManager.freezeFunds(testWallet, 250n, 'contract-B');
        assert.strictEqual(await walletManager.calculateBalance(testWallet), 50n);
        walletManager.commitFunds('contract-B');
        assert.strictEqual(await walletManager.calculateBalance(testWallet), 300n);
    });
});
