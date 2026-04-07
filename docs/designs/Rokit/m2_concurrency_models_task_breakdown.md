# Rokit Milestone 2: Per-Entity Concurrency Models - Task Breakdown

## Overview
This document outlines the actionable, discrete tasks required to annihilate the global promise stack processing bottleneck identified in the Verimus network architecture. The targeted work shifts the monolithic consensus structure into granular **Striped Promise Locks (Keyed Mutexes)** and utilizes Node.js event-loop telemetry to resolve false-positive slashings via backpressure awareness.

Each task must be executed autonomously without disrupting the broader system. Agents acting on these steps must incorporate robust `try...finally` memory bounds around locking primitives to prevent state corruption. Updates to the test harness must be implemented per task bounds.

---

### Task 1: Establish Keyed Mutex Utility
**Objective**: Build a robust, memory-safe execution queue that maps individual string identifiers (`blockId`, `forkId`) to independently serializing asynchronous promise chains.

**File Targets**:
- **Create**: `utils/KeyedMutex.ts`
- **Create Unit Test**: `test/utils/KeyedMutex.test.ts`

**Context & Specifications**:
1. Implement a class `KeyedMutex` that maintains an internal `Map<string, Promise<void>>`.
2. Expose an `acquire(key: string): Promise<() => void>` mechanism. If a promise currently exists for that key, block execution until the previous promise resolves.
3. The function must return a `release` callback that cleanly drops the active execution lock. To avoid memory leaks, if the wait-queue for a given key reaches zero, the key **must** be actively deleted from the Map.
4. **Testing Infrastructure**: Construct unit tests that purposefully fire parallel interleaved mocked promises against `KeyedMutex`. Verify mathematically that calls with identical keys serialize (execute sequentially) and calls with distinct keys process parallel overlapping operations flawlessly.

---

### Task 2: Striped Concurrency Implementation for Block Validation
**Objective**: Decouple the sequential execution logic inside the `MempoolManager` parsing payload signatures and fund balancing. Allow non-related blocks to be validated concurrently over the Node.js event loop.

**File Targets**:
- **Modify**: `peer_handlers/mempool_manager/MempoolManager.ts`
- **Modify Unit Test**: `peer_handlers/mempool_manager/test/MempoolManager.test.ts`

**Context & Specifications**:
1. Remove any overarching, generic `this.executionMutex` loops injected at the class level during Milestone 1.
2. Initialize an instance of the newly created `KeyedMutex` inside the `MempoolManager`.
3. Wrap the interior business logic of `handlePendingBlock(block, connection)` with `const release = await this.mutex.acquire(block.hash)`. Critically, structure the surrounding evaluation logic utilizing a strict `try { /* validation */ } finally { release(); }` implementation to prevent the mutex from deadlocking upon an ungraceful error rejection.
4. **Testing Infrastructure**: Instantiate concurrent unit tests sending multiple `handlePendingBlock` invocations containing mocked sleep-delays simultaneously. Verify via timestamp logs that mutually exclusive validations returned before matching validations natively executed sequentially.

---

### Task 3: Fork-Level Concurrency & Interval Cleanup in BFT Processing
**Objective**: Isolate Byzantine Fault Tolerant logic (`AdoptFork`, `ProposeFork`) dynamically tied to the specific chain collision boundary (`forkId`) rather than locking global propagation entirely. 

**File Targets**:
- **Modify**: `peer_handlers/bft_coordinator/BftCoordinator.ts`
- **Modify Unit Test**: `peer_handlers/bft_coordinator/test/BftCoordinator.test.ts`

**Context & Specifications**:
1. Excise the generalized global `executionMutex` wrapper around asynchronous operations inside the active class map. 
2. Setup a localized `KeyedMutex` map specifically for BFT state interactions. Map operations natively binding validations tied natively to the specific physical layer parameters matching `forkId`.
3. Replace lingering untracked `setTimeout` operations regarding scheduling proposals with properly tracked execution paths running explicitly behind specific `forkId` mutexes—preventing overlaps hitting the `eligibleForks` / `settledForks` arrays indiscriminately.
4. **Testing Infrastructure**: Reconfigure bounds tests ensuring the `bft_coordinator` effectively manages state arrays for Fork A independent of Fork B natively resolving without crossover corruption.

---

### Task 4: Global Auditor Event-Loop Backpressure Integration
**Objective**: Dynamically pause or scale Proof-of-Spacetime penalty timeouts based on the local Node.js engine load. End the false-positive instantiation of `SLASHING_TRANSACTION` generations triggered by organic processing delays.

**File Targets**:
- **Modify**: `peer_handlers/global_auditor/GlobalAuditor.ts`
- **Modify Unit Test**: `peer_handlers/global_auditor/test/GlobalAuditor.test.ts`

**Context & Specifications**:
1. Utilize the native Node.js `perf_hooks` (e.g., `monitorEventLoopDelay`) during instantiation of the `GlobalAuditor` layer to build a lightweight event loop tracking index. 
2. Intercept the penalty countdown logic inside the `attemptChallenge()` routine explicitly testing `node:perf_hooks` loop limits.
3. If the active event loop delay calculation dramatically exceeds safe bounds (e.g., `> 100ms`), dynamically expand the `MAX_RETRIES` base timeout boundary relative to the delay mapping. Only execute slashing if the timeout expires and the node's loop logic is fundamentally healthy and unblocked natively.
4. **Testing Infrastructure**: Artificially mock the `perf_hooks` return vectors indicating extensive system lag structurally mimicking queue exhaustion scenarios. Assert that the slashing interval is correctly suppressed natively.

---

### Task 5: Stabilize Architecture and Validate E2E Integration Models
**Objective**: Run the comprehensive internal networking and test integration pipelines validating granular concurrent locking resolves the backlog stalls directly and accurately without deadlocks.

**Context & Specifications**:
1. Test concurrent system behavior scaling via standard `npm test` mapping natively preventing lock bleeding.
2. Validate the specific E2E environments simulating "6 pending blocks anomaly" testing pipelines utilizing partitioned validation to verify smooth processing execution rates bypassing the 6-block bottleneck directly mapped dynamically.
3. Assert absolute 0 syntax breaks via standard typed verification tools (`npx tsc --noEmit` and `npx eslint --fix`).
