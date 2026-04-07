# Rokit Milestone 1: Decoupling the Monolith

## Design Document

### 1. Background

Within the current architecture, the `ConsensusEngine` operates as a rigid, monolithic service bounding entirely distinct network responsibilities. Inside a singular class constraint, it controls:

1. **Mempool Management:** Caching pending blocks and handling initial structure validation rules.
2. **BFT Network Consensus:** Processing P2P Vote states, Fork Proposals, Adoptions, and resolving network convergence.
3. **Global Audits (PoSt):** Orchestrating Merkle-tree based Proof-of-Spacetime challenges, verifying multi-megabyte physical data chunks, and autonomously publishing `SLASHING_TRANSACTION` reward blocks.

Due to this deep coupling, all runtime operations are forced through a single global promise chain (`this.taskQueue`), effectively creating a node-wide mutex lock. Simultaneously, the PoSt auditing engine leverages un-managed asynchronous timers (`setTimeout`) to trace audit delays. If the primary global queue is stalled—yielding to a dense database lookup or syncing branch delay—these timers evaluate out of sync. Target honest nodes miss their audit windows internally, prompting the network to blindly execute false-positive penalizations against them.

We must decouple these sub-systems to destroy this concurrency bottleneck.

---

### 2. Proposed Solution: Event-Driven Component Model (Actor Pattern)

In an execution format inspired by standard microservice architecture and the Actor Model (found in Erlang/Akka implementations), the monolithic engine will be severed into self-contained, isolated state managers. These managers communicate purely through an internal asynchronous message bus via Node's native `events.EventEmitter`, eliminating explicit class dependency mapping.

**Proposed Entities:**

- **`MempoolManager`**: Responsible for the rigid ingestion, validation, and storage limit bounds of uncommitted P2P blocks. Emits `MEMPOOL:BLOCK_VERIFIED` events.
- **`BFTCoordinator`**: Governs purely the network state machine for proposals and adoptions. It subscribes to verified block broadcasts and triggers the `BFT:FORK_COMMITTED` resolution payload.
- **`GlobalAuditor`**: An entirely separate runtime construct listening to ledger finalities. Operates its own dedicated queuing system for tracking Merkle sequences, ensuring timeouts are never starved by `BFTCoordinator` operations.

#### Pros

- **Decisive Concurrency Isolation:** The complete isolation between actors explicitly solves the false-positive slashing bug. The `GlobalAuditor` timeline constraints operate independently of the `BFTCoordinator` queue payload.
- **Targeted Lock Bounds:** Mutex locks can be downsized to secure individual states (e.g., locking access to a specific pending block ID) rather than locking the entire engine context wrapper.
- **Elimination of Single Responsibility Violations:** Code boundaries become strict, immensely simplifying testing constraints via dummy event emission.

#### Cons

- **Execution Traceability Limit:** Complex operational errors jumping across asynchronous event buses become inherently harder to trace linearly than direct synchronous call stacks.
- **Message Contract Overhead:** Requires strict, rigorously defined payload boundaries for events to prevent phantom data regressions across components.

---

### 3. Alternatives Considered

#### Alternative 1: Service Composition (Dependency orchestration)

Instead of severing the code using an event bus, `ConsensusEngine` acts as an orchestrator class, initializing independent `MempoolManager` and `GlobalAuditor` subclasses on boot. The main class manually routes execution parameters directly. (e.g. `await this.mempoolManager.validate(block); await this.globalAuditor.checkIntervals();`).

**Pros:**

- **Linear Debugging Stack:** Method calls are strictly direct. Debugging stack traces print concise execution flows straight back to the orchestrator limit.
- **Simpler Initial Lift:** Requires less re-architecting of the node's bootstrap sequence compared to an Event bus integration.

**Cons:**

- **Fails Global Queue Goal:** Because the `ConsensusEngine` still directs traffic linearly, operations remain tethered to the orchestrator's central mutex bounds. We carry the risk of locking out the PoSt auditor during long BFT convergence cycles, failing to resolve the primary objective roadmap requirement.
- **Tightly Coupled Runtime:** The orchestrator class inherently degrades back into a broad "god class" required to know the intricate details of component functions.

#### Alternative 2: True Hardware Isolation (OS Worker Threads)

Extract the PoSt Auditing mechanism, Merkle tree construction (`cryptoUtils.buildMerkleTree`), and physical buffer readings strictly into a segregated NodeJS `worker_threads` context.

**Pros:**

- **Absolute Resource Defense:** The NodeJS main event loop handling Mempool and BFT traffic achieves total immunity against the heavy cryptographic CPU cycles demanded by continuous PoSt analysis limits.

**Cons:**

- **Data Serialization Thrash:** NodeJS worker threads do not share conventional heap space. Every multi-megabyte physical layer requested by the auditor requires expensive `Buffer` clones mapped back and forth across the thread barrier, bottlenecking disk I/O performance massively.
- **Architectural Overkill:** The root roadmap vulnerability exists in flawed promise queue implementation, not absolute CPU starvation constraints. Thread pooling generates structural latency overhead unsupported by the current lightweight goal execution payload.

---

### 4. Conclusion & Recommendation

Based strictly on the comparative analysis, the **Event-Driven Component Model** clearly aligns best with the timeline requirements dictated by the `Rokit` initiative.

Unlike pure Service Composition (Alternative 1), the Event Model provides the explicit, decoupled runtime environments necessary to terminate the queue-starvation false-positive slash occurrences. Furthermore, it accomplishes this stabilization without introducing the vast data-transfer latencies forced by multi-threaded processes (Alternative 2). By treating `ConsensusEngine` components as pseudo-microservices, the resulting system embraces clean separation patterns vital for sustained future development scales.

---

### 5. Testing Strategy

Given the shift from a monolithic class limit to an isolated Event-Driven Component Model, the testing validation parameters formally adapt to capitalize strictly on decoupled bounds matching all `AGENTS.md` guidelines.

#### 5.1 Unit Testing Strategy

- **Pattern:** Components explicitly transition into isolated Input/Output boundary assertions.
- **Ruleset:** Sub-systems must exclusively assert input event triggers matching outgoing event broadcast conclusions without bleeding network mock dependencies.
- **Strict Mocking:** Agents constructing test blocks must leverage native `node:test` tools (`mock.fn()`) exclusively. Defensive boundary checks skipping type enforcement (`as any`) are strictly prohibited representing a test harness failure.

#### 5.2 Integration Testing Strategy

- **Pattern:** Because `ConsensusEngine` becomes a transparent message bus, top-level tests logically represent integration domains validating across internal classes natively.
- **Ruleset:** Integration operations must orchestrate complete end-to-end P2P packet resolution guaranteeing `Mempool` updates accurately trigger `BFTCoordinator` network broadcasts securely.
- **Hermetic Executions:** P2P simulated instances must execute exclusively using ephemeral states (e.g., `MongoMemoryServer` boundaries and OS-managed temp directories) definitively preventing artifact contamination.

#### 5.3 End-To-End (E2E) Strategy

- **Pattern:** Simulating massive external payload injections guaranteeing operational limits map securely preventing the "false-positive queue starvation" slash limit.
- **Ruleset:** The final tests confirm that multi-party network boundaries organically clear the 6-block pending anomaly without producing arbitrary system faults. Zombie test processes (orphaned MongoDBs) must be aggressively purged executing node cleanups.
