# Task Breakdown: Storage Node Staking Integration

**Objective:** Implement the "Global Storage Registry" enforcing zero-trust collateral validation across all storage limit orders natively utilizing the `STAKING_CONTRACT` block protocol. Protect `UploadHandler` orchestrations from zero-sunk-cost Sybil actors generating unprotected storage nodes mapping explicitly across active consensus routes securely safely effectively.

## Core Components Modified

- `ledger/Ledger.ts`
- `wallet_manager/WalletManager.ts`
- `peer_handlers/sync_engine/SyncEngine.ts`
- `test/integration/SlashingAndStaking.test.ts`

---

## Tasks

### Task 1: Initialize Global Storage Provider Registry

**Context:** The node database must persist the state of all actively staked storage hosts proportional to our validator array cache schema.
**File:** `ledger/Ledger.ts`
**Action:**

1. Append `activeStorageProvidersCollection: Collection<import('../types').StakingContractPayload> | null;` as a class property matching the `activeValidatorsCollection` signature definitions.
2. Unpack and resolve this new MongoDB interface handle (`this.activeStorageProvidersCollection = this.db.collection('activeStorageProviders');`) inside the `init()` async boundaries execution.
3. Establish a standard unified unique MongoDB index on `operatorAddress` (`await this.activeStorageProvidersCollection.createIndex({ "operatorAddress": 1 }, { unique: true });`) preventing duplicate staking records.

### Task 2: Escrow Intercept and Mapping Registration Cache

**Context:** When a specific block signals `BLOCK_TYPES.STAKING_CONTRACT`, the Wallet limits tracking must synchronously deposit the data into the active storage provider collection registry.
**File:** `wallet_manager/WalletManager.ts`
**Action:**

1. Locate the block conditional logic processing `BLOCK_TYPES.STAKING_CONTRACT` inside `updateIncrementalState(block)`.
2. Extract `operatorAddress`, `collateralAmount`, and `minEpochTimelineDays` from the `StakingContractPayload` wrapper definitions.
3. If `colAmt > 0n`, query the active collection to retrieve existing collateral parameters tied to the `operatorAddress`. Add the new bounds tracking sum to the existing value scaling parameters dynamically.
4. Execute `updateOne` mapping `{ operatorAddress }` using `$set: { collateralAmount: <total>, minEpochTimelineDays: <new_minimum> }` parameters coupled with `{ upsert: true }`.

### Task 3: Execution Filtration Gateway (The Sybil Check)

**Context:** Limit orders orchestrating chunk shards must verify the staking ledger limits bounding the proposed incoming P2P storage node explicitly preventing default exposure parameters tracking un-collateralized nodes.
**File:** `peer_handlers/sync_engine/SyncEngine.ts`
**Action:**

1. Open the `handleStorageBid(msg, connection)` function executing limit order acceptance boundaries evaluating physical requests.
2. Isolate internal lookup logic referencing `await this.node.ledger.activeStorageProvidersCollection.findOne({ operatorAddress: msg.storageHostId })`.
3. Construct a standard `MINIMUM_STORAGE_STAKE` EVM variable constant (e.g., `ethers.parseUnits("5000", 18)` representing minimum VERI lockup arrays limit).
4. Verify the recorded MongoDB entry exceeds the minimum scalar threshold constants parameters.
5. If the `collateralAmount` bounds fail verification or if no record is found mapped tracking natively, drop the `StorageBidMessage` instantly and execute `return;`.

### Task 4: Destructive Penalty Evictions (Slashing Enforcement)

**Context:** Nodes that fail Space/Time constraints boundaries map deterministic slashing burns removing local funds natively. Remove limits from the registry when collateral burns beneath the operational scope limits dynamically.
**File:** `wallet_manager/WalletManager.ts`
**Action:**

1. Proceed to `BLOCK_TYPES.SLASHING_TRANSACTION` execution mappings handling penalties bounds.
2. Implement synchronous parallel queries fetching the penalized operator from the `activeStorageProvidersCollection` bounds matching limits structure constraints.
3. If the host exists, dynamically subtract `burntAmount` from the tracked `collateralAmount` tracking states properties.
4. Condition eviction variables scaling tracking limits executing: If the remaining collateral drops beneath `MINIMUM_STORAGE_STAKE`, trigger `deleteOne({ operatorAddress })` execution removing the offending node from the limits permanently.

### Task 5: Integration Testing Infrastructure Implementations

**Context:** Add validations validating P2P behavior when staking requirements intercept storage bids dynamically covering definitions boundaries parameters mapping.
**File:** `test/integration/SlashingAndStaking.test.ts`
**Action:**

1. Build an integration sub-test executing `StorageBidMessage` arrays mappings limiting parameters definitions logically explicitly. Test sending a bid.
2. Assert that a node without a preceding injected `STAKING_CONTRACT` block gets strictly ignored and excluded from the limits arrays bounds metrics.
3. Inject a `STAKING_CONTRACT` payload natively executing explicit limits tracking bounds and subsequently assert the node bid processes flawlessly.
4. Submit a synthesized `SLASHING_TRANSACTION` enforcing dropping mathematical boundaries beneath limits and verifying the collection purges the node inherently bounds limits. Verify the collection purges the node.

### Task 6: Initialize Baseline Host Network Storage Stakes

**Context:** When the local network is spawned via our deployment scripts, default peer nodes must inherently stake tokens immediately so that initial testnet file seeding does not fail against the new storage lockup barriers.
**File:** `scripts/spawn_nodes.sh`
**Action:**

1. Locate block step block `"4. Injecting Baseline Escrow Funding via MongoDB..."` inside `spawn_nodes.sh`.
2. Appended immediately matching the `db.balances.updateOne(...)` execution, inject a second explicit `mongosh` evaluation natively seeding the `activeStorageProviders` collection constraint boundaries.
3. Structure and interpolate a `$set` block execution allocating `{ operatorAddress: '$NODE_ADDR_CHECKSUM', collateralAmount: "5000000000000000000000", minEpochTimelineDays: "365" }`.
4. Run locally traversing limit parameters executing `./scripts/spawn_nodes.sh` simulating complete genesis limits.
