# Milestone 4: Integration Stress Testing & Verification Task Breakdown

This document outlines the precise developmental tasks required to fully execute the M4 In-Memory Asynchronous Chaos Mesh integration design. The sequence isolates synthetic network modeling and applies stress logic uniquely validating Rokit architectural upgrades.

## Task 1: Construct the P2P Chaos Mock Router

**Target Component**: `test/utils/ChaosRouter.ts` (New File)
**Objective**: Build a programmable mock wrapper proxying standard network connections to inject configurable latencies and partition states.
**Instructions**:

1. Create a `ChaosRouter` utility class designed to encapsulate mock peer arrays and intercept `.send()` or `.broadcast()` methods seamlessly.
2. Implement an `injectJitter(minMs, maxMs)` function that utilizes asynchronous timers (`setTimeout`) to stagger synthetic packet delivery mimicking unpredictable real-world latency bounds.
3. Formulate an `injectDropRate(percentage)` hook structured to randomly return early, simulating hard packet drops and validating the engine's deterministic retry or state reconciliation mechanics.
4. Export the integration wrapper cleanly to support seamless implementation across existing test modules.

## Task 2: Implement Chaos Mesh in `LoadStress.test.ts`

**Target Component**: `test/integration/LoadStress.test.ts`
**Objective**: Substitute rigid static arrays with high-jitter, high-volume transactional stress.
**Instructions**:

1. Refactor the network setup within `LoadStress.test.ts` to marshal cross-peer message relaying through the new `ChaosRouter` initialized with extreme latencies (e.g., 50-250ms).
2. Synthetically stream hundreds of concurrent `PendingBlock` payload validations against the mock cluster.
3. Add rigid assertions ensuring that the `BftCoordinator` flawlessly coordinates multi-node `Adoptions`, checking explicitly that the `Mempool` queue sizes reliably resolve exactly to `0` without deadlocking the `KeyedMutex` logic.

## Task 3: Assert Deterministic Auditor Slashing Exclusivity

**Target Component**: `test/integration/SlashingAndStaking.test.ts`
**Objective**: Prove `GlobalAuditor` intelligently prevents false-positive slashing during significant, valid network delays but ruthlessly targets genuine Byzantine failures.
**Instructions**:

1. Update `SlashingAndStaking.test.ts` to spin up a mock validator cluster utilizing the active `ChaosRouter` to mimic baseline organic network lag constraints universally across all nodes.
2. Explicitly script exactly one specific mock peer to behave maliciously, explicitly suppressing its organic return pathway for the `MerkleProofChallengeRequestMessage`.
3. Force a full BFT epoch pipeline validation and assert that exactly one `SLASHING_TRANSACTION` is generated dynamically, and it strictly targets only the pre-defined malicious actor. Assert that honest nodes—despite operating under artificial async delays—do not encounter penalty flags.

## Task 4: Codebase Documentation & Architecture Parity

**Target Component**: `README.md`
**Objective**: Finalize Rokit domain documentation to explicitly represent the structural paradigm shift cleanly.
**Instructions**:

1. Read the existing `README.md` architecture sections mapping node responsibilities.
2. Update the technical descriptions to accurately dissect `ConsensusEngine` into its respective sub-components (`GlobalAuditor`, `MempoolManager`, `BftCoordinator`).
3. Describe the state-machine transition structures governing `SyncEngine` instead of boolean queues.
4. Remove legacy documentation referencing global `taskQueues` or monolithic promise-chain deadlocks, cementing the codebase's new modular paradigm permanently.
