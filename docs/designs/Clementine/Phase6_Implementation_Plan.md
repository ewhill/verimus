# Phase 6: Chain Scalability & Ledger Pruning

The goal of this phase is to implement state checkpoints, allowing nodes to consolidate past block history into a single tracking entity and surgically prune the underlying MongoDB `blocks` collection. This prevents infinite linear scaling of the `WalletManager` calculation loops and storage space.

## Proposed Changes

### `constants.ts`
- **[MODIFY]** Add `CHECKPOINT: 'CHECKPOINT'` into the `BLOCK_TYPES` constant mapped object.

---

### `types/index.d.ts`
- **[MODIFY]** Add `CheckpointStatePayload` interface defining `epochIndex`, `startHash`, `endHash`, `stateMerkleRoot`, and `activeContractsMerkleRoot` (replacing the raw $O(N)$ massive JSON arrays to ensure the block size remains strictly $O(1)$).
- **[MODIFY]** Add `CheckpointBlock` interface extending `Block` with `type: typeof BLOCK_TYPES.CHECKPOINT` and the `CheckpointStatePayload`.
  - **Why is this block type needed?** Normally, `WalletManager` evaluates every peer's balance by iterating through the entire ledger history natively. The `CHECKPOINT` block secures the state roots allowing immediate historical pruning.

### Architectural Justification: Resolving Infinite Wallet RAM Bottlenecks (Continuous State)
You correctly identified that compiling an array of millions of wallets in-memory at Block 1,000,000 would result in catastrophic Out-of-Memory (OOM) crashes. To completely resolve this scaling bottleneck, we are shifting from **"Epoch Recalculation"** to **"Continuous Incremental State Mapping"** (the industry-standard architecture behind Ethereum's State Trie). 
Rather than calculating balances from scratch, the `WalletManager` will maintain a persistent native MongoDB `balances` collection. Every time a block is adopted linearly, the engine incrementally updates the specific `sender` and `recipient` database records natively. Because the state is continuously maintained in physical storage, calculating the $O(1)$ `stateMerkleRoot` at the `CHECKPOINT` boundary demands absolute zero RAM—it merely hashes the sorted, persistent database collection. This elegantly scales to infinite active network wallets!

### Example CHECKPOINT Block Formulation
When the network reaches an index boundary (e.g., 1,000,000 blocks), the currently authorized block proposer (selected seamlessly by the overarching `ConsensusEngine` Proof-of-Stake/Reputation election mechanics identically to standard blocks) temporarily assumes the "leading peer" role. This node natively compiles the internal continuous `balances` collection mapping, hashes it via SHA-256 to generate the `stateMerkleRoot`, and autonomously broadcasts the `CHECKPOINT` block into the network via `ProposeForkMessage`. Other nodes mirror the verification, matching their generated roots with the proposal, and cast consensus adoption messages.
```json
{
  "metadata": {
    "index": 1000000,
    "timestamp": 1715423859000
  },
  "type": "CHECKPOINT",
  "previousHash": "c5f7d1a... (Hash of block 999,999)",
  "publicKey": "SYSTEM_OR_VALIDATOR_PUB_KEY",
  "payload": {
    "epochIndex": 1,
    "startHash": "0000000... (Genesis Hash)",
    "endHash": "c5f7d1a... (Hash of block 999,999)",
    "stateMerkleRoot": "f8a72b143c... (O(1) Hash of the off-chain JSON balance map)",
    "activeContractsMerkleRoot": "1d8b2e3..."
  },
  "signature": "..."
}
```


---

### `ledger/Ledger.ts`
- **[MODIFY]** Create an `async pruneHistory(checkpointIndex: number)` function that deletes all blocks with `metadata.index < checkpointIndex` from the MongoDB `blocks` collection, actively reclaiming physical disk space natively.

---

### `wallet_manager/WalletManager.ts`
- **[MODIFY]** Remove the linear ledger traversal from `calculateBalance(peerId)`. Instead, natively query a new optimized MongoDB `balances` collection mapping the deterministic token float values.
- **[NEW]** Implement an `updateIncrementalState(block: Block)` hook. Whenever `ConsensusEngine` commits a standard transaction, strictly adjust the corresponding MongoDB `balances` records in real-time. 
- **[NEW]** Implement an `async buildStateRoot()` generator that queries the sorted `balances` cursor, streaming the cryptographic Merkle Root without violating RAM parameters to natively populate the `CHECKPOINT` proposal format.

---

### `peer_handlers/consensus_engine/ConsensusEngine.ts`
- **[MODIFY]** Inject an Epoch boundary tracker inside `_commitFork`. If the newly committed `metadata.index` crosses the `EPOCH_SIZE` threshold (or dynamically triggers the boundary), the node calculates `walletManager.buildStateRoot()` and proposes a `CHECKPOINT` block into the `mempool`.
- **[MODIFY]** In `handlePendingBlock`, intercept `BLOCK_TYPES.CHECKPOINT`. To validate, the node mathematically computes its own `buildStateRoot()` expectation. If the proposed root mismatches the local root, the check fails (preventing state forgery). If valid, standard verification proceeds. Upon committing a `CHECKPOINT`, seamlessly invoke `this.node.ledger.pruneHistory(checkpoint.metadata.index)`.

---

### `test/integration/LedgerPruning.test.ts`
- **[NEW]** Write a new integration test mapping a `MongoMemoryServer` instance. 
- Simulate reaching the 1,000,000 block boundary by manually injecting a mock block configured with `metadata.index = 999,999` into the test chain, then broadcasting the final 1,000,000th block bounding the epoch logic. This allows us to perfectly test the exact production scaling constants directly.
- Assert that `WalletManager.calculateBalance()` returns identical accurate tracking output despite the database history being actively purged.
- Verify `ledger.collection.countDocuments()` aggressively drops beneath the genesis sum, strictly leaving the `CHECKPOINT` tracking block intact.

## Verification Plan

### Automated Tests
- Execute `npm test` to ensure no existing components are broken by the new `CHECKPOINT` blocks.
- Run the new `npx tsx test/integration/LedgerPruning.test.ts` to strictly assert pruning mathematical bounds and MongoDB physical deletion behaviors.
- Ensure `npx tsc --noEmit` and `npx eslint` bounds remain perfectly satisfied.
