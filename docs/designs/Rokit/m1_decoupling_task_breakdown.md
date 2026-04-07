# Rokit Milestone 1: Decoupling the Monolith
## Task Breakdown

### Overview
This document outlines the actionable, discrete tasks required to dismantle the monolithic `ConsensusEngine` into three functionally isolated, event-driven components: `MempoolManager`, `BftCoordinator`, and `GlobalAuditor`. 

Each task is structured to allow granular, autonomous execution in isolation, ensuring strict adherence to the project's Typescript standards, directory rules, and Git operational guidelines.

---

### Task 1: Extract `GlobalAuditor` Sub-System
**Objective**: Detach Proof-of-Spacetime (PoSt) auditing from the general consensus lock mechanism to prevent false-positive slashings caused by queue starvation.

**File Targets**:
- **Create**: `peer_handlers/global_auditor/GlobalAuditor.ts`
- **Create Unit Test**: `peer_handlers/global_auditor/test/GlobalAuditor.test.ts`
- **Modify**: `peer_handlers/consensus_engine/ConsensusEngine.ts`

**Execution Steps**:
1. Assure structural compliance by creating the new `global_auditor/` directory. Scaffold the strict Typed `GlobalAuditor` class ensuring all standard project import maps (EIP-712 schemas, constants) match cleanly.
2. Cut the `runGlobalAudit()`, `verifySlashingEvidence()`, `computeDeterministicAuditor()`, and associated Merkle response tracking handlers off the `ConsensusEngine`. Transfer them explicitly into `GlobalAuditor`.
3. Set up an isolated scoped instance lock natively inside `GlobalAuditor` to guarantee its interval routines (`setInterval` maps) never overlap independently of other node activities.
4. Replace direct method dependencies for penalizations. If an audit fails, the `GlobalAuditor` must broadcast `this.peerNode.events.emit('AUDITOR:SLASHING_GENERATED', slashPayload)` instead of assuming direct network `broadcast()` execution.
5. **Testing Profile**: Write strict test arrays in `test/GlobalAuditor.test.ts` utilizing `mock.fn()` limits for the event emitter. Simulate a failed Merkle challenge response and assert the `AUDITOR:SLASHING_GENERATED` is successfully emitted.

---

### Task 2: Extract `MempoolManager` Sub-System
**Objective**: Decouple pending block ingestion, structural evaluation, and signature caching logic out of broader P2P BFT adoption cycles.

**File Targets**:
- **Create**: `peer_handlers/mempool_manager/MempoolManager.ts`
- **Create Unit Test**: `peer_handlers/mempool_manager/test/MempoolManager.test.ts`
- **Modify**: `peer_handlers/consensus_engine/ConsensusEngine.ts`

**Execution Steps**:
1. Scaffold execution boundaries logically for `mempool_manager/MempoolManager.ts`.
2. Extract `handlePendingBlock()` alongside the comprehensive signature parsing and EIP-191 balance checks from `ConsensusEngine` to this new class.
3. Repoint the root `Mempool` memory store to be evaluated locally via this domain controller explicitly.
4. Modify the execution conclusion. Once verified structurally, instead of manually spawning nested vote verifications directly, the routine must emit: `this.peerNode.events.emit('MEMPOOL:BLOCK_VERIFIED', blockId)`.
5. **Testing Profile**: Architect unit tests executing block evaluations ensuring structural bounds pass. Mock Ethers wallet verification stubs safely guaranteeing `MempoolManager.test.ts` independently catches and asserts rejections without network bounds.

---

### Task 3: Extract `BftCoordinator` Sub-System
**Objective**: Isolate Byzantine Fault Tolerant logic (State Voting, Fork Resolution, Blockchain Appends).

**File Targets**:
- **Create**: `peer_handlers/bft_coordinator/BftCoordinator.ts`
- **Create Unit Test**: `peer_handlers/bft_coordinator/test/BftCoordinator.test.ts`
- **Modify**: `peer_handlers/consensus_engine/ConsensusEngine.ts`

**Execution Steps**:
1. Produce the final component block `bft_coordinator/BftCoordinator.ts` mapped per standard.
2. Relocate `handleProposeFork`, `handleAdoptFork`, `handleVerifyBlock`, `_checkAndProposeFork`, and `_commitFork`.
3. Update BFT interactions that heavily abused the global promise queue natively mapping parallel access blocks instead to dedicated granular, fork-level mutex locking.
4. Program `BftCoordinator` to boot its P2P cycles in total dependency isolation by hooking onto the `MEMPOOL:BLOCK_VERIFIED` emission dynamically sent by the `MempoolManager`.
5. **Testing Profile**: Instantiate `BftCoordinator.test.ts`. Use internal test-harness event payloads simulating simulated Fork proposals matching genesis block properties, ensuring correct tracking arrays compile effectively before settling the mock tip hashes.

---

### Task 4: Rewire `ConsensusEngine` as pure Event Bus / Bridge
**Objective**: Shrink `ConsensusEngine` explicitly into a thin bridging wrapper connecting raw P2P Network Message boundaries securely to internal `EventEmitter` nodes dynamically preventing tightly-coupled memory assignments.

**File Targets**:
- **Modify**: `peer_handlers/consensus_engine/ConsensusEngine.ts`
- **Modify Unit Test**: `peer_handlers/consensus_engine/test/ConsensusEngine.test.ts`

**Execution Steps**:
1. Eliminate all leftover logical arrays, the `this.taskQueue` properties, and any lingering physical timeout bindings mapped globally.
2. Instantiating the 3 new sub-managers inside `ConsensusEngine`'s constructor natively connecting their internal bus loops.
3. Refactor `bindHandlers()`. Discard direct internal mappings resolving P2P `VerifyBlockMessage` natively; replace them entirely with `this.peerNode.events.emit('NETWORK:INBOUND_VERIFY_BLOCK', payload)` to trigger the independent asynchronous sub-controllers properly.
4. Execute aggressive dead code pruning across the file ensuring any legacy interfaces verifying internal boundaries natively are strictly obliterated matching absolute decoupling limits.
5. **Testing Profile**: Restructure `ConsensusEngine.test.ts` solely to validate correct bridging. Mock inbound P2P elements guaranteeing the explicit standard format `NETWORK:` events are triggered natively holding perfect parameter conformity.

---

### Task 5: Stabilize Architecture and Validate Parity
**Objective**: Ensure that ripping apart the domain architecture resolves the `6 pending blocks anomaly` natively without destroying core repository behavior tests logic.

**Execution Steps**:
1. Conduct complete system execution bounds via `npx tsc --noEmit` globally mapping 0 outstanding missing type errors post-refactoring.
2. Correct formatting maps aggressively utilizing `npx eslint --fix "**/*.ts"`.
3. Perform integration simulations using standard `npm test` mapping to guarantee total environment network compatibility confirming unblocked PoSt loops natively bypassing queue bounds perfectly.

---

### Task 6: Reconstruct `ConsensusEngine` Integration Pipeline Tests
**Objective**: Ensure the newly bridged `ConsensusEngine` correctly routes P2P interactions across the discrete internal message bus components securely.
**File Targets**:
- **Modify**: `peer_handlers/consensus_engine/test/ConsensusEngine.test.ts`
**Execution Steps**:
1. Strip tests that evaluated rigid internal private properties or assumed direct database mutation by `ConsensusEngine` natively.
2. Initialize hermetic `MongoMemoryServer` boundaries restricting disk overlap.
3. Submit a payload mimicking an external `PendingBlockMessage` P2P wrapper execution.
4. Set explicit assertions verifying the payload triggers the appropriate `MEMPOOL:BLOCK_VERIFIED` emission, validating accurate message proxy delivery across the event bus without locking.

### Task 7: Establish E2E Resolution Bounds
**Objective**: Verify the exact bugs driving the "Rokit" refactor (6-pending-blocks anomaly, false-positive crash slashings) are entirely destroyed under a production-like concurrent workflow setup.
**Execution Steps**:
1. Build or augment an E2E test file designed to flood the new isolated `MempoolManager` queue continuously parallel to BFT proposals without locking.
2. Monitor background operations validating that `GlobalAuditor` intervals never halt triggering unjust `SLASHING_TRANSACTION` broadcasts.
3. Configure `afterAll` test teardown endpoints executing `pkill -f mongod` natively to safely destroy arbitrary background processes avoiding zombie resource leaks between execution nodes.
