# Project Bandana: Milestone 3 - Ledger-Enforced Pruning & Data Garbage Collection (GC) Design

## 1. Background

With Milestone 1 and 2 successfully mapping chronological constraints into the core wallet escrow limits and peer-to-peer storage market, nodes are now actively limiting storage contracts over time boundaries. However, once a contract mathematically reaches its `expirationBlockHeight`, the ledger safely zeros out the node's financial escrow disbursement, but the physical data footprint indefinitely persists on the storage provider's physical hard-disk arrays.

As Verimus intends to serve as a decentralized, self-managing physical storage layer, host nodes require a robust garbage collection (GC) mechanism. Nodes must autonomously identify when a contract's index timeline expires to violently evict the physical shards, reclaiming local capacity without risking arbitrary slashing penalties orchestrated via the `GlobalAuditor`.

---

## 2. Initial Proposed Approach: Deterministic Epoch-Triggered Pruning

This approach directly ties physical file deletion to the decentralized deterministic "block-clock," synchronizing natively off of `Ledger.ts` finality.

1. The `Ledger` currently emits physical `blockAdded` events executing deterministic hooks synchronously.
2. A new `GarbageCollector` or `PruningHook` listener is registered that intercepts the newly minted `currentBlockIndex`.
3. The hook immediately queries the local `storage_contracts` database mapping: `WHERE expirationBlockHeight <= currentBlockIndex`.
4. For every resulting expired contract, the node queries its active `StorageProvider` to execute a native file deletion (`fs.unlink` equivalent).
5. Concurrently, the `GlobalAuditor` is hardened securely using a pre-flight evaluation guard: prior to issuing a `MerkleProofChallengeRequestMessage`, the auditor explicitly verifies `currentBlockIndex < contract.expirationBlockHeight` to bypass obsolete records passively.

### Pros

- **Atomic Concurrency**: Execution is absolutely perfectly synchronized with the network. An auditor will never construct a challenge for an expired file because the entire ledger explicitly shares identical boundary limits.
- **Zero Network Overhead**: Host nodes reclaim disk capacity locally without needing to broadcast "deletion completion" ledgers across the P2P sockets. The math dictates the reality.
- **Resilient to Sync Jumps**: By utilizing an inequality query (`<=`) rather than strict equivalence (`===`), nodes performing bulk fast-syncs catching up to the network will naturally flush all lagging expired contracts natively without skipping specific missed index ticks.

### Cons

- **Block Phase Heaviness**: Appending heavy I/O operations (physical file unlinking) onto the critical path of the consensus `blockAdded` finality loop slightly slows down block progression locally.

---

## 3. Alternative Approach 1: Background Polling Sweeper (Wall-Clock Cron)

Rather than binding physically to the ledger's sequence, the GC pipeline executes as a standalone background `setInterval` loop entirely decoupled from block validation loops (e.g., executing every 300 seconds).

1. The cron timer wakes up, queries the target mapping bounded against the latest known `node.ledger.getLatestBlock()`.
2. Delete files directly mimicking standard OS-level garbage cleanup.

### Pros

- **High Performance Finality**: Extraneous physical file management is pulled entirely off of the fragile `blockAddedSubscribers` thread, preventing sequential lag during blockchain alignment.

### Cons

- **Auditor Race Conditions**: The `GlobalAuditor` runs randomly based on continuous block sequences natively. If a contract expires on `Block 100`, the active `setInterval` cleanup might not execute physically until `Block 102`. An auditor could execute an audit on `Block 101`. The file might still be intact or half-deleted, leading to extreme asynchronous unpredictability and potential severe false positive network slashing events. The `Wall-Clock` lacks synchronized integrity matching the rest of the decentralized node array.

---

## 4. Alternative Approach 2: Explicit "Eviction" Transaction Blocks

Nodes are restricted from aggressively deleting physical payloads until an explicit `EVICTION_BLOCK` payload is verified mapping standard network mempool structures tracking exact payload teardowns.

### Pros

- Absolute consensus mappings ensuring nodes globally agree to drop data identically.

### Cons

- **Massive Network Bloat**: Forces nodes to pay gas networks tracking file teardowns natively. The system is structurally mapped strictly dynamically exactly to omit this problem via mathematical expiration heights. Introducing explicit transactions completely bypasses the intelligent `targetDurationBlocks` engineering drafted in M2 entirely.

---

## 5. Comparative Analysis & Decision Synthesis

Alternative 2 is completely unviable given the explicit objective of self-maintaining limits designed natively during Milestone 2 boundaries.

Alternative 1 (Polling Sweeper) brings immense physical disk I/O liberation off the main thread but severely risks breaking the `GlobalAuditor`. If a host mathematically deletes the file milliseconds before an auditor queries it mapping an un-swept array, severe false positive penalizations will occur mapping reputation drops securely.

The **Initial Proposed Approach (Deterministic Epoch-Triggered Pruning)** leverages identical deterministic execution pipelines successfully proven via the existing `processEpochTick` lock mechanisms. The tradeoff involving I/O load blocking local consensus loops can be mitigated efficiently securely mapping the `StorageProvider` deletion calls using asynchronous (non-awaited non-blocking) fire-and-forget executions organically, ensuring the consensus pointer advances securely.

**Decision: Proceed with the Deterministic Epoch-Triggered Pruning model.**

The node will natively query database collections strictly executing physical file tear-downs deterministically hooked exactly into the `blockAdded` emitter natively, while the `GlobalAuditor` inherently inherits explicit temporal barriers ignoring data queries tracking `< currentHeight`.
