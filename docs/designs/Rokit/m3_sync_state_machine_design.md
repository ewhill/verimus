# Milestone 3: Deterministic Sync State Machine

## 1. Background

The "Rokit" initiative dictates surgical architectural improvements across the Verimus networking topology. Currently, the Verimus local network inherently relies on the `SyncEngine` to facilitate consensus validity and ledger availability across newly joined peers. However, the current iteration is notoriously fragile due to several intertwined monolithic flaws:

- **Fragile Sync Buffers:** `SyncEngine` leverages unbounded raw memory arrays (`syncBuffer`) governed purely by a single `isSyncing` boolean hook. Asynchronous faults during synchronization epochs routinely orphan incoming blocks within this buffer, sparking massive memory leaks and silently locking nodes out of executing their local consensus loop indefinitely.
- **Ambiguous Sync Transitions:** The existing synchronization evaluates inside `performInitialSync()` as a single contiguous monolithic thread without any granular state boundaries. The system provides zero metric differences between fetching headers, computing consensus tips, or executing structural validation bindings. If the connection fails halfway through a 10,000 block fetch, the monolithic lock drops entirely and forces the node to eventually start completely from index 0 again.
- **BFT Pipeline Wakeup Failures:** During active heavy validation, the single `performInitialSync` lock drops the `isSyncing` boolean prior to emptying the `syncBuffer`. If the array happens to be functionally barren exactly when the BFT triggers execute, the active BFT proposal pipeline can stall out indefinitely, requiring a restart to bootstrap the BFT loop securely.

## 2. Alternatives Considered

Before restructuring the entire engine, we assessed less invasive paradigms.

### Alternative 1: Promote `syncBuffer` array to a persistent MongoDB schema

- **Pros:**
  - Very low refactoring impact. We swap the in-memory array queue with a persistent database queue mapped statically across the `isSyncing` phase.
  - Successfully prevents orphaned blocks natively, permanently suppressing the memory leak.
- **Cons:**
  - Utterly fails to address the underlying monolithic instability. The engine remains a rigid, singular `performInitialSync` logic loop that cannot dynamically halt, pause, or resume specific sub-stages internally.
  - It maintains a black-box implementation lacking granular telemetry.
- **Verdict:** Abandon. This merely bandages the symptom (the memory leak) without alleviating the root architectural weakness spanning the engine.

### Alternative 2: Integrate RxJS Observables for deterministic stream management

- **Pros:**
  - Standard industry practice built natively for event-driven asynchronous data feeds. Capable of organically caching, timing out, and merging massive chunk layers flawlessly.
- **Cons:**
  - Extremely heavy external dependency, sharply inflating the web socket core runtime footprint.
  - Bridging pure functional reactivity mappings internally back into the `Ledger` (which currently loops tightly on simple `findOne` paradigms) introduces overwhelming boilerplate.
- **Verdict:** Abandon. Introduces excessive complexity without definitively bridging the BFT components cleanly.

## 3. Proposed Solution: Formalized Deterministic State Machine

To formally construct an environment capable of predictable synchronization boundaries, the `SyncEngine` will be decisively restructured around a formal State Machine.

### Architecture: Core States

Instead of the binary `isSyncing = true/false` mapping, the engine will adopt strict enumerations:

- `OFFLINE`: Node is isolated natively. Web sockets are attached, but the local ledger is completely out of parity.
- `SYNCING_HEADERS`: Gathering lightweight chain tips and calculating the longest contiguous valid fork securely mathematically.
- `SYNCING_BLOCKS`: Bulk downloading and structurally validating explicit blocks isolated logically inside indexed boundaries.
- `ACTIVE`: Highly synchronized mapping natively catching live BFT loop engagements.

### Persistence: The Ophan Tracker

- The legacy `syncBuffer` array will be replaced with a persistent, indexed stack hosted directly in the database logic limits. Any P2P `PendingBlock` logic received whilst the node evaluates a `SYNCING_BLOCKS` state is unconditionally mapped to this isolated table, explicitly enforcing strict chronological P2P boundaries.
- During the `SYNCING_BLOCKS -> ACTIVE` transition, the engine structurally processes this queue chronologically safely natively.

### BFT Event Bridging

- Bridging the `SyncEngine` seamlessly into the `ConsensusEngine` natively relies completely upon a decoupled `EventBus` bridge. Calling `handlePendingBlock` directly across modules drops structural decoupling. Instead, execution routes strictly across formalized events perfectly mapping to the exact State Machine thresholds.

### Conclusion (Comparative Impact)

**Pros:**

- Explicit deterministic state hooks drastically improve telemetry bounds effortlessly.
- Adopts the exact same predictable synchronization patterns natively popularized throughout standard top-tier blockchains.
- Systematically resolves block cache drops without compromising architectural boundaries.

**Cons:**

- The highest logical complexity curve, modifying a massive swath of legacy handlers natively hooked into `SyncEngine`.
- Mandates intensive synchronization bounds unit testing natively isolated across explicit component wrappers.
