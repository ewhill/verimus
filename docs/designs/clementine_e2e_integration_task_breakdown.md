# Task Breakdown: Clementine E2E Storage Lifecycle Validation

**Objective:** Refactor the `test/integration/ClementineLifecycle.test.ts` suite to completely abandon "direct-to-ledger" block injection cheating. The test must definitively prove that real end users can upload files via the HTTP boundary and that storage nodes can exclusively bid on these uploads only after proving 5,000 VERI physical collateral boundaries.

## Core Components Modified

- `test/integration/ClementineLifecycle.test.ts`

---

## Tasks

### Task 1: Purge Hardcoded Escrow Mocks

**Context:** The existing Phase 2 & 3 integrations synthesize `STORAGE_CONTRACT` blocks directly targeting the ledger instance array, circumventing network limit orders completely.
**File:** `test/integration/ClementineLifecycle.test.ts`
**Action:**

1. Locate the test block `[Phase 2 & 3] Originator Negotiates an active STORAGE_CONTRACT P2P Agreement`.
2. Delete the `createSignedMockBlock(w3, BLOCK_TYPES.STORAGE_CONTRACT, payload, 5)` mock logic and the explicit `node1.ledger.addBlockToChain(block)` push mechanism.
3. Keep the initial test setup and wallet structures intact to prepare for the authentic network execution framework.

### Task 2: Inject Authentic Host Protocol Staking (`STAKING_CONTRACT`)

**Context:** For the decentralized network to facilitate an upload, at minimum 3 internal nodes must publicly register their `activeStorageProviders` status through the explicit staking mechanism.
**File:** `test/integration/ClementineLifecycle.test.ts`
**Action:**

1. Generate an explicit `STAKING_CONTRACT` block for `nodes[2]`, `nodes[3]`, and `nodes[4]`. The payload must allocate a minimum `collateralAmount: ethers.parseUnits("5000", 18)`.
2. Push these blocks into the network mesh either via standard `handlePendingBlock` mempool ingestion or via direct genesis validation bounds.
3. Implement a polling loop asserting that the respective Nodes map internal `node.ledger.activeStorageProvidersCollection.findOne` tracking states resolving the `ethers.parseUnits("5000", 18)` boundaries.

### Task 3: Execute Genuine End-User Pipeline Trigger

**Context:** The Originator (Node 1) must act as a true gateway proxy interacting via standard endpoints.
**File:** `test/integration/ClementineLifecycle.test.ts`
**Action:**

1. Synthesize a temporary dummy file utilizing `fs.writeFileSync`.
2. Exploit Node 1's active Express listener triggering an un-mocked HTTP boundary mapping via a `POST /api/upload` `fetch()` or `axios` target routing to `http://127.0.0.1:${nodes[1].port}`.
3. Assign the originating test wallet (`wallets[1].address`) as the `ownerAddress` along with a valid cryptographic signature authorizing the REST endpoint.
4. Pass the absolute path of the dummy file into the upload payload.

### Task 4: Assert Decentralized Limit Order Negotiation

**Context:** Validate that the system tracks the resulting limit order bids matching the exact hosts that staked prior, producing a finalized contract with bound capabilities.
**File:** `test/integration/ClementineLifecycle.test.ts`
**Action:**

1. Assert the upload API returns HTTP 200 indicating success.
2. Query Node 1's `activeContractsCollection` caching limits in the local ledger.
3. Assert `activeHosts` captures the staked node addresses exclusively, indicating limit checking enforced the origin routes to `nodes[2].walletAddress`, `nodes[3].walletAddress`, and `nodes[4].walletAddress`.

### Task 5: Assert Authentic File Download (Retrieval Cycle)

**Context:** Prove the package can be fully reassembled utilizing the P2P swarm by querying the network for the specific `STORAGE_CONTRACT` hash.
**File:** `test/integration/ClementineLifecycle.test.ts`
**Action:**

1. Exploit Node 1's Express listener utilizing a `GET /api/download/:contractHash?ownerAddress=X&signature=Y` request targeting the `STORAGE_CONTRACT` from Task 4.
2. Assert the API constructs and returns a standard HTTP 200 response with the exact unified buffer matching the original dummy file from Task 3.
3. Validate Node 1's `SyncEngine` accurately broadcasted the `StorageShardRetrieveRequestMessage` and collected legitimate symmetric keys logically from the specific active hosts.

### Task 6: Validate Hosting Escrow Tokenomics (Escrow Deductions)

**Context:** Verify the origin wallet's balance is properly depleted reflecting the massive storage market finder's fee and that the hosts generated valid `TRANSACTION` blocks securing their rewards.
**File:** `test/integration/ClementineLifecycle.test.ts`
**Action:**

1. Query `node1.consensusEngine.walletManager.calculateBalance(wallets[1].address)` and assert the user wallet's balance is exactly decremented by the market cost calculated in the `STORAGE_CONTRACT`.
2. Query `activeContractsCollection` to resolve exactly how much token weight was placed exclusively into the contract's `escrowAmount`.
3. Assert that the underlying Node 2, Node 3, and Node 4 balances escalated proportional to their shard distributions via algorithmic `TRANSACTION` settlements.

### Task 7: Execute Storage Contract Purging (Eviction Cycle)

**Context:** The end-user must be able to issue a destructive command to purge the `STORAGE_CONTRACT` from the host arrays securely and permanently.
**File:** `test/integration/ClementineLifecycle.test.ts`
**Action:**

1. Transmit an authenticated `DELETE /api/delete/:contractHash` to Node 1's REST router.
2. Assert the router produces a valid HTTP 200 termination signal.
3. Query `nodes[2].storageProvider`, `nodes[3].storageProvider`, and `nodes[4].storageProvider` ensuring their physical cache buffers are deleted and completely purged of the shard fragments.
