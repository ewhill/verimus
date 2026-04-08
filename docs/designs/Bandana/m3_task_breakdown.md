# Project Bandana: Milestone 3 - Ledger-Enforced Pruning & Garbage Collection (Task Breakdown)

This document outlines the actionable, discrete tasks required to fully implement the **Deterministic Epoch-Triggered Pruning** system designed for automatic storage contract payload evictions across the Verimus peer-to-peer network.

## Task 1: Ledger Queries for Contract Expirations

**Objective**: Build database retrieval logic to isolate temporally-expired `STORAGE_CONTRACT` transactions securely without suffering from BigInt MongoDB type-casting mismatch issues.

- **Target File**: `ledger/Ledger.ts`
- **Actions**:
    1. Implement a new asynchronous class method: `async getExpiredContracts(currentIndex: number): Promise<Block[]>`.
    2. Instruct the Mongo cursor dynamically targeting native document records matching `{ type: BLOCK_TYPES.STORAGE_CONTRACT }`.
    3. Loop over the returned records explicitly (and execute `hydrateBlockBigInts` natively upon them).
    4. Isolate and return the populated blocks containing an `expirationBlockHeight` mathematically lesser than or equal to `BigInt(currentIndex)`.
- **Testing**:
  - Ensure new integration test constraints in `Ledger.test.ts` simulate adding pseudo-historical chronological contracts, verifying the correct records are explicitly indexed and separated.

## Task 2: Scaffold Deterministic Garbage Collector Hook

**Objective**: Abstract physical eviction bindings outside the direct `Ledger.ts` class natively constructing a reliable parallel-tracked `GarbageCollector` pipeline.

- **Target File**: `peer_handlers/garbage_collector/GarbageCollector.ts` (New component & directory)
- **Actions**:
    1. Create the `GarbageCollector` class expecting a robust `PeerNode` injected via constructor parameters.
    2. Hook the physical runtime bounds tracking the native ledger emission pattern explicitly: `this.node.ledger.events.on('blockAdded', ...)`.
    3. During the emission, capture the `block.metadata.index`. Immediately fetch `await this.node.ledger.getExpiredContracts(currentIndex)`.
    4. Pluck the fragment maps iterating for targets containing `this.node.walletAddress`. Iterate across locally mapped `physicalId` identities explicitly executing deterministic deletion mappings utilizing non-blocking asynchronous mapping: `this.node.storageProvider.deleteBlock(physicalId).catch(() => {})`.
    5. Ensure the I/O promises execute in standalone `Promise.all` detached scopes to completely avoid sequentially pausing native block alignments natively.
- **Testing**:
  - Construct `GarbageCollector.test.ts` simulating `blockAdded` emitter calls against mock storage providers tracking `deleteBlock` counts strictly verifying un-associated peers do not delete non-owned records gracefully.

## Task 3: Node Instantiation

**Objective**: Guarantee the garbage reclamation loop is decisively initialized during standard network bootstrapping natively integrating the hooks physically without external overrides.

- **Target File**: `peer_node/PeerNode.ts`
- **Actions**:
    1. Instantiate `this.garbageCollector = new GarbageCollector(this)` seamlessly inside the core bootstrap/init hooks physically alongside existing native handlers (`syncEngine`, `consensusEngine`).
- **Testing**:
  - Update `PeerNode.test.ts` to assert that accessing `node.garbageCollector` returns an initialized object post-constructor boot cleanly securely avoiding regression crashes.

## Task 4: Global Auditor Sync Compatibility

**Objective**: Secure the decentralized validation algorithm naturally filtering out evictions natively avoiding massive slashing faults strictly safely.

- **Target File**: `peer_handlers/global_auditor/GlobalAuditor.ts`
- **Actions**:
    1. Locate the native interval entry point orchestrating proofs (`runGlobalAudit`).
    2. When pulling records natively selecting random chunks (from `ownedBlocks`), introduce an exact preemptive validation loop explicitly discarding and un-linking elements tracking `contract.payload.expirationBlockHeight <= currentHeight`.
    3. Discard tracking and drop queries explicitly preventing the auditor from building deterministic payloads mapping unlinked disk footprints natively.
- **Testing**:
  - Expand `GlobalAuditor.test.ts` explicitly mutating expiration structures mapped securely behind the active simulated cursor. Verify that unlinking completely omits the generation of `SLASHING_TRANSACTION` footprints explicitly validating zero false positive bounds physically.

---

### Implementation Guidelines

1. **Never block the event loop**: Unlink filesystem physical I/O streams dynamically.
2. **Handle re-entrance**: Guard multiple `blockAdded` rapidly fired structures concurrently without throwing redundant `ENOENT` filesystem panics tracking identical deletion queues naturally.
