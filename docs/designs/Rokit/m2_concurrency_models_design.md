# Rokit Milestone 2: Per-Entity Concurrency Models Design Document

## 1. Background
During the initial Verimus "Clementine" update, extreme network congestion exposed several critical performance and data-integrity flaws related to the system's asynchronous handling. The overarching problem is rooted in the architecture's reliance on a singular, global `taskQueue`. Currently, the `ConsensusEngine` essentially halts global execution whenever a single P2P validation cycle yields or queries the database. This means that a network fetch or a localized delay regarding a specific block (e.g., Block A) forces the validation of an entirely unrelated block (e.g., Block B) to stall.

Furthermore, several critical background operations—such as BFT fork proposing logic and Proof-of-Spacetime (PoSt) auditing evaluations—attempted to bypass this global lock entirely by utilizing isolated `setTimeout` intervals. These arbitrary "rogue" callbacks execute asynchronously oblivious to the main global queue, routinely mutating shared memory structures like the Mempool simultaneously. This produces race conditions leading directly to the recurring "6 pending blocks anomaly".

Finally, the `GlobalAuditor` evaluates peer responsiveness using hardcoded timeouts. Because the network halts unpredictably behind the global queue, target nodes are occasionally unable to construct and return Merkle Proofs in time. The auditor interprets this processing delay as malicious evasion, triggering the false-positive instantiation of `SLASHING_TRANSACTION` broadcasts against innocent, albeit backlogged, validators. Resolving this necessitates granular per-entity parallel processing, disciplined asynchronous boundaries, and backpressure-aware auditing logic.

---

## 2. Initially Proposed Solution: The Actor Model (Multi-Threading / Worker Threads)
### Architecture
The initial "industry-standard" approach to true parallel throughput across CPU-heavy cryptography contexts (like blockchains) is the Actor Model, often implemented in Node.js via `worker_threads`. 

In this structure, the node spins up persistent, isolated background threads representing different actors (e.g., a "Mempool Actor," a "BFT Coordinator Actor," and a "Validation Actor"). The `ConsensusEngine` acts strictly as a centralized router. Incoming blocks and P2P data payloads are serialized and dispatched to an available background worker on a completely different physical event loop. Each thread holds and mutates its isolated internal state context and coordinates exclusively through Message-Passing (IPC). P2P events operate concurrently across physical hardware layers.

### Pros
- **True Physical Parallelism**: A bogged-down cryptographic signature validation for Block A happening in Worker 1 has zero impact on the Main Thread routing Block B to Worker 2.
- **Hardware Yielding**: Eliminates event-loop lag on the core networking thread, ensuring WebSockets drop fewer connections.
- **Extreme Isolation**: A failure or infinite loop in a malformed fork adoption algorithm completely kills that specific isolated thread without crashing the Verimus Node.

### Cons
- **Massive Refactoring Burden**: The implementation fundamentally diverges from the current shared-memory environment (`Mempool` maps, Ledger cache) used by Verimus sub-managers.
- **High IPC Overhead**: Moving heavy objects like 1MB blocks and fragmented Merkle structs across the V8 isolate boundary constantly can become incredibly expensive and negate the parallelism speedup.
- **Complexity**: Requires building multi-thread coordination mechanics (e.g., SharedArrayBuffer concurrency guards), sharply violating the "Rokit" principle to maintain existing cryptographic boundaries without aggressive structural upheaval.

---

## 3. Alternatives Considered

### Alternative A: Global Lock with Priority Queuing (The Status Quo Band-Aid)
Rather than achieving true concurrency, the system could maintain the singular global `taskQueue` but inject prioritization via an external library like `async-priority-queue`. P2P network handshakes and fast blocks bypass heavy PoSt validation calculations inside the serial stack.

- **Pros**: Extremely low engineering effort. Does not require rewriting memory handling or mutating the BFT algorithms natively.
- **Cons**: This is merely a bandage; it fundamentally fails to satisfy the Milestone 2 objective of "annihilating the singular global bottleneck." A singular slow database op still locks the entire node; the execution boundaries are still linear.

### Alternative B: Keyed Mutexes (Striped Promise Locks) & Event-Loop Lag Monitoring
Under this approach, execution stays within a single Node.js process and leverages the native Event-Loop paradigm. Instead of a single task queue, the system utilizes **Striped Keys (Keyed Mutexes)** mapped dynamically to discrete identifiers (e.g., `blockId` or `forkId`). 

When a sub-manager needs to run validations on Block 0xabc, it acquires an asynchronous lock explicitly for `0xabc`. Inbound processing for Block 0xdef can proceed immediately and concurrently because it acquires a distinct lock for `0xdef`. To address rogue timeouts, all `setTimeout` implementations are restructured to resolve behind the designated `forkId` mutex, forcing strict serial alignment uniquely isolated to matching domains. To prevent false-positive slashings, `GlobalAuditor` utilizes `perf_hooks` (or event loop delay tracking via `uv_loop`) to identify periods of CPU backpressure. If event delay exceeds 200ms, the auditor pauses the slashing timeout interval until the node's local load recovers.

- **Pros**: 
  - Allows highly granular concurrency, keeping the Verimus thread busy via asynchronous interleaving without cross-contamination.
  - Native Node.js pattern (requires no heavy external IPC logic, avoiding extreme refactoring overhead compared to `worker_threads`).
  - Gracefully addresses delayed Merkle Proof challenges by intelligently pausing the Global Auditor's timer based on actual CPU lag (Event Loop Metrics), thus eliminating false-positive slashings safely.
- **Cons**:
  - Memory Leak Risks: If a promise chain faults without properly calling `mutex.release()`, that specific hash becomes permanently deadlocked. Requires highly disciplined engineering (abundant use of `try...finally`).

---

## 4. Final Proposed Approach (Pivot)

Through comparative analysis, it is clear that while adopting the **Actor Model (Worker Threads)** provides strong architectural purity for scalability, the massive engineering overhaul and high serialization overhead natively contradict the scope of the "Rokit" refactor. 

Verimus is predominantly an asynchronous I/O-bound architecture (P2P routing and Database insertions) rather than a continuously heavy CPU-bound application. Node.js natively handles massive parallel concurrent I/O remarkably well when freed from artificial bottlenecks.

Therefore, we are pivoting the final recommendation to adopt **Alternative B: Keyed Mutexes & Event-Loop Backpressure Monitoring**.

**Why this approach wins:**
1. **Targeted Resolution**: Implements pinpoint lock boundaries tied explicitly to entities (Forks, Blocks). Unrelated operations inherently process concurrently over the Event Loop.
2. **Minimal Restructuring**: It preserves the shared-memory `Mempool` architectures integrated during Milestone 1, preventing heavy rewrite debt while natively fixing the "pending block race conditions."
3. **Auditor Backpressure**: Integrating `perf_hooks` to trace and offset PoSt timeout windows completely mitigates false-positive slashings resulting from honest local traffic digestion latency. 
4. **Safety via Language Construct**: By integrating strict wrapper utilities resolving mutexes inside rigorous `try { ... } finally { ... }` boundaries, we can practically eliminate the primary disadvantage (lock leaking).
