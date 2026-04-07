# Milestone 3: Deterministic Sync State Machine Task Breakdown

This document rigorously maps the exact sequential development tasks necessary to systematically completely upgrade the Verimus network's `SyncEngine` strictly away from vulnerable static RAM arrays to the explicit Deterministic State Machine structure outlined natively in the M3 design.

## ✅ Task 1: Establish Formal Sync States and Enumerations

**Target Component**: `peer_handlers/sync_engine/SyncEngine.ts` and `types/`
**Objective**: Annihilate the fragile binary boolean flag limits tracking synchronization and introduce a strict, formal state machine mapping internally.
**Instructions**:

1. Define a strict typescript `enum SyncState` containing the exact logical phases: `OFFLINE`, `SYNCING_HEADERS`, `SYNCING_BLOCKS`, and `ACTIVE`. Place this cleanly within the global `types/` schema boundary limits.
2. Inside `SyncEngine.ts`, rip out all references definitively mapping the boolean `isSyncing` variable natively. Replace this inherently with a `currentState: SyncState` tracking variable correctly typed explicitly mapped initialized to `OFFLINE`.
3. Implement a rigid, formal internal mutator function natively (e.g., `transitionState(newState: SyncState)`) that explicitly validates and handles explicit state thresholds, gracefully logging the topological shift contextually preventing black-box execution limits natively.
4. Ensure all synchronous evaluations checking `if (this.isSyncing)` safely migrate to the correct `currentState > SyncState.OFFLINE` limits.

## ✅ Task 2: Migrate `syncBuffer` to Persistent Database Orphan Tracker

**Target Component**: `ledger/Ledger.ts` and `peer_handlers/sync_engine/SyncEngine.ts`
**Objective**: Drop the volatile RAM array mapping and structurally introduce a highly persistent, query-capable DB schema safely locking block inputs internally.
**Instructions**:

1. Directly within `Ledger.ts`, natively initialize and expose a secondary formal database limit `orphanBlocksCollection` natively tracking the existing MongoDB `db` hooks globally routing seamlessly natively parallel to identical architecture paradigms locally.
2. Inside `SyncEngine.ts`, completely delete the archaic `syncBuffer: SyncBufferEvent[]` array hook locally.
3. Any active listeners capturing raw BFT data (e.g., dynamically observing native events across handlers) safely must execute `.insertOne` explicitly mapping the parameters into the explicit database wrapper instead of mapping to the RAM array logically explicitly.
4. During the synchronized block fetch iteration within `performInitialSync`, accurately preserve chronological routing. Wait until formal evaluation logic natively executes `transitionState(ACTIVE)` securely before actively looping and systematically destroying the explicit cache layer mapping naturally.

## ✅ Task 3: Implement BFT Event Bus Decoupling Bridging

**Target Component**: `peer_handlers/sync_engine/SyncEngine.ts` and `peer_handlers/consensus_engine/ConsensusEngine.ts`
**Objective**: Strip direct inter-module calls entirely safely converting all state bridging cleanly towards decoupled native `Node:EventEmitter` limits seamlessly.
**Instructions**:

1. Locate the native execution bounds evaluating `this.node.consensusEngine.handlePendingBlock(...)` spanning wildly directly originating inside `SyncEngine`.
2. Rewrite the structural loop inherently correctly securely terminating `performInitialSync`. Fetch the chronologically mapped explicit payload objects strictly natively queried organically out of `this.node.ledger.orphanBlocksCollection`.
3. Dispatch the payload structurally explicitly by invoking `this.node.events.emit('SYNC_PHASE_COMPLETE', blockPayload)` rather than artificially firing `ConsensusEngine` method loops manually mapping directly natively.
4. Hook a secure native event listener mapping strictly to `SYNC_PHASE_COMPLETE` explicitly organically configured into the `bindHandlers()` initialization layer belonging definitively to `ConsensusEngine.ts`. Verify the internal logic catches and dispatches mapped tasks to the granular `KeyedMutex` locks completed securely in M2 precisely accurately routing accurately securely.

## ✅ Task 4: Stabilize Architecture and Validate M3 Integration

**Target Component**: `peer_handlers/sync_engine/test/SyncEngine.test.ts`
**Objective**: Verify the complete structural modifications successfully logically natively routing explicitly securely catching all M3 conditions flawlessly safely inherently.
**Instructions**:

1. Open the integration tests corresponding definitively to the `SyncEngine` module securely mapping limits organically natively.
2. Mock the persistent database boundary cleanly organically matching exactly equivalent configurations natively mapping `orphanBlocksCollection.insertOne` elegantly organically cleanly routing.
3. Dynamically assert explicitly evaluating deterministic State Machine limits guaranteeing execution seamlessly progresses deterministically spanning correctly mapping across boundaries explicit thresholds routing accurately.
4. Execute `npm test` natively cleanly validating the complete `peer_handlers` integration pipeline accurately routing reliably limits explicit mapping cleanly.
5. Correct all possible explicitly reported TypeScript compilation gaps manually checking `npx tsc --noEmit` bounds flawlessly securely mapping accurately.
