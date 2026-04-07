# Codename: Rokit 🚀
## Verimus Consensus & Sync Refactoring Roadmap

### 1. Executive Summary
The "Clementine" architectural upgrades revealed critical limits and instability within the Verimus local network structure, characterized by perpetually pending blocks, stalls, and unexpected false-positive slashings. 

The **"Rokit"** initiative is a strategic, surgical architectural refactor of the P2P data flow, consensus engine, and state reconciliation layers (`ConsensusEngine` and `SyncEngine`). This refactor comprehensively replaces monolithic global promise chains and un-managed asynchronous timers with logically isolated components and granular concurrency models, **without altering** the foundational cryptographic business rules (EIP-712 typing, Merkle Tree PoSt, Storage Contracts).

### 2. Identified Architectural Flaws to Resolve
1. **Global Promise Queue Bottleneck:** The primary `taskQueue` promise chain in `ConsensusEngine` operates as a node-wide global mutex lock. If an arbitrary P2P interaction or database query yields, the entire node stalls, backing up hundreds of incoming messages.
2. **Rogue Control Timers:** `setTimeout` functions controlling BFT fork proposals and Spacetime verification timeouts execute dynamically *outside* the rigid queue locking mechanism. This leads to overlapping mutations against the active mempool block cache, producing persistent data corruption and the documented infinite pending blocks.
3. **False-Positive Slashings:** Congestion from the global promise queue prevents target nodes from calculating and responding to Merkle Proof challenges in time. The auditor node blindly interprets this delay as an evasion or forgery and indiscriminately issues a global `SLASHING_TRANSACTION` punishment against honest peers.
4. **Fragile Sync Buffers:** `SyncEngine` leverages raw memory arrays (`syncBuffer`) governed purely by an `isSyncing` boolean hook. Asynchronous faults during synchronization epochs routinely orphan the data payloads stored in this buffer, silently locking the node indefinitely.

---

### 3. Milestones & Deliverables

#### Milestone 1: Decoupling the Monolith
**Objective:** Disentangle the massive `ConsensusEngine` into explicitly bounded, single-responsibility sub-managers.
**Deliverables:**
- **[ ]** Extract PoSt calculations, Merkle logic, and reward/slashing transaction execution into a dedicated `GlobalAuditor` component out of the primary loop.
- **[ ]** Elevate `Mempool` management and preliminary block structural validation into an isolated state controller, limiting `ConsensusEngine` strictly to handling BFT networking cycles (Propose, Vote, Adopt).
- **[ ]** Refactor associated unit tests (`ConsensusEngine.test.ts`, etc.) to map explicitly to the new architectural splits without polluting structural imports.

#### Milestone 2: Per-Entity Concurrency Models
**Objective:** Annihilate the singular global `taskQueue` bottleneck, granting the network the ability to parallel process discrete network layers safely.
**Deliverables:**
- **[ ]** Establish a **Block/Fork-Level Mutex** system. Validations handling `Block A` should never inherently stall the receipt and validation of an entirely unrelated `Block B`.
- **[ ]** Standardize dynamic P2P background events (e.g., Fork Proposals) to utilize queue-safe integrations rather than rogue asynchronous callbacks.
- **[ ]** Update `GlobalAuditor` timelines to handle P2P backpressure intelligently, dynamically isolating actual malicious omissions from organic node processing bottlenecks.

#### Milestone 3: Deterministic Sync State Machine
**Objective:** Implement a predictable, rigid synchronization environment inside the `SyncEngine`.
**Deliverables:**
- **[ ]** Restructure the `SyncEngine` into a formal State Machine (`OFFLINE` -> `SYNCING_HEADERS` -> `SYNCING_BLOCKS` -> `ACTIVE`).
- **[ ]** Enforce rigid P2P routing boundaries—orphan payloads caught mid-sync map safely to an indexed persistent stack, permanently destroying the "dropped buffer" memory leak.
- **[ ]** Introduce safe bridging patterns that flawlessly awaken the BFT pipeline following a successful sync convergence sequence.

#### Milestone 4: Integration Stress Testing & Verification
**Objective:** Prove long-term system stability in a hermetic environment and align codebase parity.
**Deliverables:**
- **[ ]** Conduct aggressive E2E network simulation runs (`npm test`) specifically designed to trigger overlap conditions without stalling.
- **[ ]** Verify `SLASHING_TRANSACTION` generation drops linearly to only target mathematically corrupt validators implicitly simulated.
- **[ ]** Finalize parity across API and structural tracking documents (`README.md`, `AGENTS.md`) matching the new `Rokit` domain definitions natively.
