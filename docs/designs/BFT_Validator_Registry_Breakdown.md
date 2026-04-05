# Task Breakdown: On-Chain Validator Registry Migration

This living document serves as the implementation checklist and technical requirements guide for transitioning Verimus from an insecure connection-based BFT heuristic (High Water Mark) to a fully deterministic, on-chain Proof of Stake Validator Registry.

## Core Conceptual Changes
1. **Payload Standard**: Strict adherence to the `STAKING_CONTRACT` block type for tracking active node operator stakes.
2. **Synchronous Validation Cache**: Because consensus evaluation (`majority` votes) executes synchronously within the WebSockets loop, the Ledger persistence layer must actively cache the active validator array in-memory.
3. **Epoch Mechanics**: `majority` bounds must NEVER dynamically shift mid-evaluation. The ledger strictly recalculates and refreshes the validator array only upon encountering pre-defined block intervals (Epoch boundaries). This prevents desynchronization across the mesh.

---

## Task Checklist & Execution Plan

### Task 1: Scaffolding Staking Payload Contracts
*   **Target Files**: `types/index.d.ts`, `constants.ts`
*   **Description**: Ensure that `STAKING_CONTRACT` is correctly registered sequentially within the architecture. Define the interface `StakingContractPayload` matching `{ validatorAddress: string, stakeAmount: bigint, action: 'STAKE' | 'UNSTAKE' }`.
*   **Test Update**: Update `Ledger.test.ts` to mock generic serialization behaviors of this payload strictly (ensuring `bigint` hydration rules process staking correctly).

### Task 2: Persistence Storage Collection Mapping
*   **Target Files**: `ledger/Ledger.ts`
*   **Description**: Instantiate and link an `activeValidatorsCollection: Collection<Validator>` onto the MongoDB tracking interface natively in the class constructor and `init()` flow. Inject strict logic into `purgeChain()` and `pruneHistory()` to drop the respective bounded collections natively when networks reboot gracefully.

### Task 3: In-Memory Validation Map & State Aggregation
*   **Target Files**: `wallet_manager/WalletManager.ts` & `ledger/Ledger.ts`
*   **Description**: Construct a state-forwarding interceptor that updates the MongoDB `activeValidatorsCollection` automatically when the `WalletManager` finalizes transactions. Specifically, when the `WalletManager` evaluates a block with `type === BLOCK_TYPES.STAKING_CONTRACT`, it must freeze standard balances and write/delete natively to the validators pool.
*   **Context**: A node operator submitting an unstake payload does not take immediate effect, but the database should log the intention payload.

### Task 4: Epoch Boundary Evaluations
*   **Target Files**: `ledger/Ledger.ts`, `constants.ts`
*   **Description**: Implement `export const EPOCH_LENGTH = 100;` within constants. Inside the `Ledger` block-addition sequence, evaluate whether `block.metadata.index % EPOCH_LENGTH === 0`. If true, trigger a sync sequence updating an internal class variable `activeValidatorCountCache`. This effectively locks the validator volume uniformly for 100 global blocks.

### Task 5: Refactoring `getMajorityCount` Constraints
*   **Target Files**: `peer_node/PeerNode.ts`
*   **Description**: Fully strip and replace the `networkHighWaterMark` workaround geometry. The calculation logic shifts natively to: `return Math.floor(node.ledger.activeValidatorCountCache / 2) + 1;`.
*   **Test Update**: Remove `PeerNode.test.ts` explicit reliance on `.peer.trustedPeers` mock lengths and instead mutate the internal cached validator properties to verify mathematical consensus bounds directly.

### Task 6: P2P Slashing Mechanisms & Ejection
*   **Target Files**: `peer_handlers/reputation_manager/ReputationManager.ts`, `peer_handlers/consensus_engine/ConsensusEngine.ts`
*   **Description**: Currently, `ReputationManager` tracks dormant offline nodes manually via subjective IP address metrics. Connect the system to trigger an internal `SLASHING_TRANSACTION` payload block if the mesh determines a staked validator is maliciously offline. If slashed, upon the next designated Epoch boundary, `WalletManager` intercepts it, removes them from `activeValidatorsCollection`, and dynamically reduces `N` cleanly without collapsing liveness.

### Task 7: Integration End-to-End Suite Verification
*   **Target Files**: `test/integration/ValidatorRegistration.test.ts`
*   **Description**: Draft a completely unified integration test mimicking:
    1. 5 Nodes booting and confirming baseline configuration.
    2. 1 Node injecting a formally signed `STAKING_CONTRACT` transaction block.
    3. The network reaching the predefined Epoch boundary natively.
    4. Evaluating that `getMajorityCount()` universally transitions up across the whole mesh instantly as the block height resolves over the modulo division.

---

*Note: For an AI agent working autonomously, utilize this document to stack git commits sequentially task-by-task. Mark completion status directly underneath each checklist item locally.*
