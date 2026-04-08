# Project Bandana: Milestone 1 - Task Breakdown

This document provides a granular task breakdown to execute Milestone 1: **Cryptographic Schema & Wallet Escrow Initialization**. The objective is to introduce epoch-based block expiration limits (`expirationBlockHeight`) and chronological rest-toll funding (`allocatedRestToll`) into Verimus storage contracts.

## 1. Schema & Cryptographic Upgrades

### Task 1.1: Update TypeScript Types

**Scope**: Modify `types/index.d.ts` to expand the contract payload interface.
**Instructions**:

- Locate the `StorageContractPayload` interface inside `types/index.d.ts`.
- Add `expirationBlockHeight?: bigint;` to track the expiration epoch securely without precision loss.
- Add `allocatedRestToll?: bigint;` to track the upfront capital reserved for chronological storage compensation.
**Testing**: Run `npx tsc --noEmit` to verify type implementations across all dependent files.

### Task 1.2: Upgrade EIP-712 Schema Constraints

**Scope**: Modify `crypto_utils/EIP712Types.ts` integrating the new fields into the Web3 wallet signature mapping.
**Instructions**:

- Locate the `EIP712_SCHEMAS[BLOCK_TYPES.STORAGE_CONTRACT]` array map.
- Append `{ name: 'expirationBlockHeight', type: 'uint256' }`.
- Append `{ name: 'allocatedRestToll', type: 'uint256' }`.
**Testing**: Update `EIP712Types.test.ts` (or equivalent cryptography tests) to mock a `StorageContractPayload` including both new properties. Assert that `signTypedData` successfully signs the modified payload schema without throwing signature domain discrepancies.

### Task 1.3: Define Global Storage Constants

**Scope**: Add a baseline duration metric mapping Unix approximation to actual ledger blocks.
**Instructions**:

- Locate `constants.ts` at the root directory.
- Define and export `AVERAGE_BLOCK_TIME_MS = 5000;`. This will be used in subsequent UI and Upload API logic to convert real-world user duration (e.g., 30 days) into estimated `expirationBlockHeight` equivalents.

---

## 2. Wallet Escrow Initialization

### Task 2.1: Isolate Rest-Toll Funding States

**Scope**: Modify `wallet_manager/WalletManager.ts` to track chronological escrows.
**Instructions**:

- Update internal state mapping interfaces (e.g., `EscrowState` maps) within `WalletManager` to support properties for `allocatedRestToll`, `expirationBlockHeight`, and `startBlockHeight`.
- Adjust `freezeFunds` and `commitFunds` to accept these three distinct variables separate from `allocatedEgressEscrow` parameters. This ensures liquid balances correctly reflect both explicit chronological lockups and variable egress bandwidth escrows.
**Testing**: Add a unit test to `WalletManager.test.ts` verifying `freezeFunds` correctly subtracts both the egress cost and the rest-toll cost from the user's base ledger liquid funds.

### Task 2.2: Implement Block-by-Block Disbursement Hooks

**Scope**: Modify `wallet_manager/WalletManager.ts` to disperse fractions of the `allocatedRestToll` per consensus epoch.
**Instructions**:

- Introduce a new method: `processEpochTick(currentBlockIndex: number)`.
- Inside the method, iterate through all active escrow contracts globally mapped to storage hosts.
- For each escrow, calculate the base payout ratio precisely using native bigint math: `payoutWei = escrow.allocatedRestToll / (escrow.expirationBlockHeight - BigInt(escrow.startBlockHeight))`.
- Decrement `payoutWei` from the `allocatedRestToll` escrow balance.
- Increment `payoutWei` onto the active hosting node `balances` tracking map.
**Testing**: Add unit tests in `WalletManager.test.ts`. Initialize a mocked escrow with an `allocatedRestToll` of `100` and an expiration limit 10 blocks out. Call `processEpochTick` 10 times manually asserting that the host balance receives exactly `10` wei per call and the escrow correctly zeroes out on the final block.

### Task 2.3: Connect Epoch Hooks to Ledger Convergence

**Scope**: Bridge the `Ledger` to automatically invoke the `WalletManager` per successfully committed block.
**Instructions**:

- Locate the main `commitBlock` or `appendBlock` finality logic (either inside `Ledger.ts` or `ConsensusEngine.ts`).
- Execute `this.walletManager.processEpochTick(newBlock.metadata.index)` immediately after a block definitively persists to the physical disk sequence.
**Testing**: Setup an integration suite mimicking an entire end-to-end consensus fork proposal terminating in a successful block write. Assert via spy or mock hook that `WalletManager.processEpochTick` is formally invoked with the new exact matching block integer natively.
